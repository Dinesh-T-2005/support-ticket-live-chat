const express = require('express');
const router = express.Router();
const { sql, config } = require("../config/db");
const nodemailer = require("nodemailer");
require("dotenv").config();
const multer = require('multer');
const path = require("path");
const fs = require('fs');
const ffmpeg = require("fluent-ffmpeg");
const { uploadChatFile } = require('../routes/blobHelper')
const { getChatFileStream } = require('../routes/blobHelper')


const transporter = nodemailer.createTransport({
  host: "smtp.mail.yahoo.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'mailluploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const mailupload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage()
});

const pocchatupload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'video/mp4',
      'video/quicktime',
      'video/mov',
      'application/pdf'
    ];


    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// const pocchatupload = multer({
//   storage: storage1,
//   limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
//   fileFilter: function (req, file, cb) {

//     const allowedTypes = [
//       'image/jpeg',
//       'image/png',
//       'image/jpg',
//       'video/mp4',
//       'video/mov',
//       'video/quicktime',
//       'application/pdf'
//     ];

//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type'));
//     }
//   }
// });


/* ================= CREATE TICKET ================= */
router.post('/ticket', mailupload.single('attachment'), async (req, res) => {
  try {
    const {
      issueTitle,
      issueDescription,
      category,
      instructionTitle,
      userId,
      orgId,
      email
    } = req.body;

    const file = req.file; // multer file
    const ticketCode = `TKT-${Date.now()}`;

    const pool = await sql.connect(config);

    /* ---------- SAVE TO DB ---------- */
    await pool.request()
      .input('ticket_code', sql.VarChar, ticketCode)
      .input('user_id', sql.Int, userId || null)
      .input('org_id', sql.Int, orgId || null)
      .input('issue_title', sql.VarChar, issueTitle)
      .input('issue_description', sql.Text, issueDescription)
      .input('category', sql.VarChar, category)
      .input('instruction_title', sql.VarChar, instructionTitle)
      .query(`
        INSERT INTO support_tickets
        (
          ticket_code,
          user_id,
          org_id,
          issue_title,
          issue_description,
          category,
          instruction_title,
          video_used,
          status,
          is_active
        )
        VALUES
        (
          @ticket_code,
          @user_id,
          @org_id,
          @issue_title,
          @issue_description,
          @category,
          @instruction_title,
          1,
          'OPEN',
          1
        )
      `);

    /* ---------- MAIL ---------- */
    await transporter.sendMail({
      from: `"Tresume Support" <${process.env.EMAIL_USER}>`,
      to: email,
      cc: process.env.DEV_SUPPORT_MAIL,
      subject: `🛠 New Support Ticket - ${ticketCode}`,
      html: `
    <h2>New Support Ticket Raised</h2>
    <p><b>Ticket ID:</b> ${ticketCode}</p>
    <p><b>Issue Title:</b> ${issueTitle}</p>
    <p><b>Category:</b> ${category}</p>
    <p><b>Instruction Watched:</b> ${instructionTitle || '-'}</p>
    <hr/>
    <p>${issueDescription}</p>
  `,
      attachments: file ? [{
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype
      }] : []
    });

    res.json({
      success: true,
      ticketCode,
      status: 'OPEN'
    });

  } catch (error) {
    console.error('Support Ticket Error:', error);
    res.status(500).json({
      success: false,
      message: 'Ticket creation failed'
    });
  }
});


router.get('/user/tickets/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('user_id', sql.Int, userId)
      .query(`
        SELECT 
          id,
          ticket_code,
          issue_title,
          status,
          created_at
        FROM support_tickets
        WHERE user_id = @user_id
          AND is_active = 1
        ORDER BY created_at DESC
      `);

    res.json({ success: true, data: result.recordset });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});


router.get('/user/tickets/detail/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .query(`
        SELECT *
        FROM support_tickets
        WHERE id = @ticket_id
      `);

    res.json({ success: true, data: result.recordset[0] });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch ticket detail' });
  }
});
router.post('/user/tickets/:ticketId/feedback', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { rating, feedback } = req.body;

    const pool = await sql.connect(config);

    // Check status + existing feedback
    const check = await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .query(`
        SELECT status, feedback
        FROM support_tickets
        WHERE id = @ticket_id
      `);

    const ticket = check.recordset[0];

    if (ticket.status !== 'CLOSED')
      return res.status(400).json({ message: 'Ticket not closed yet' });

    if (ticket.feedback)
      return res.status(400).json({ message: 'Feedback already submitted' });

    // Save feedback
    await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .input('rating', sql.Int, rating)
      .input('feedback', sql.Text, feedback)
      .query(`
        UPDATE support_tickets
        SET rating = @rating,
            feedback = @feedback,
            feedback_at = GETDATE()
        WHERE id = @ticket_id
      `);

    res.json({ success: true, message: 'Feedback submitted' });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Feedback failed' });
  }
});

router.get('/admin/dashboard', async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const total = await pool.request().query(`
      SELECT COUNT(*) AS total FROM support_tickets WHERE is_active = 1
    `);

    const open = await pool.request().query(`
      SELECT COUNT(*) AS open_count 
      FROM support_tickets 
      WHERE status = 'OPEN' AND is_active = 1
    `);

    const progress = await pool.request().query(`
      SELECT COUNT(*) AS in_progress_count 
      FROM support_tickets 
      WHERE status = 'IN_PROGRESS' AND is_active = 1
    `);

    const closed = await pool.request().query(`
      SELECT COUNT(*) AS closed_count 
      FROM support_tickets 
      WHERE status = 'CLOSED' AND is_active = 1
    `);

    const avgRating = await pool.request().query(`
      SELECT AVG(CAST(rating AS FLOAT)) AS avg_rating
      FROM support_tickets
      WHERE rating IS NOT NULL
    `);

    const recent = await pool.request().query(`
      SELECT TOP 5 ticket_code, id,issue_title, status, created_at
      FROM support_tickets
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: {
        total: total.recordset[0].total,
        open: open.recordset[0].open_count,
        inProgress: progress.recordset[0].in_progress_count,
        closed: closed.recordset[0].closed_count,
        avgRating: avgRating.recordset[0].avg_rating || 0,
        recentTickets: recent.recordset
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


router.get('/admin/tickets', async (req, res) => {
  try {
    const { status } = req.query;

    const pool = await sql.connect(config);

    let query = `
      SELECT id, ticket_code, issue_title, status, rating, created_at
      FROM support_tickets
      WHERE is_active = 1
    `;

    if (status && status !== 'ALL') {
      query += ` AND status = '${status}'`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});
router.get('/admin/ratings', async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT ticket_code, issue_title, rating, feedback, created_at
      FROM support_tickets
      WHERE rating IS NOT NULL
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/admin/ticket/:id', async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT *
        FROM support_tickets
        WHERE id = @id
      `);

    res.json({ success: true, data: result.recordset[0] });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// const transporter = nodemailer.createTransport({
//   host: "smtp.mail.yahoo.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   }
// });

const sendMail = async (options) => {
  try {
    await transporter.sendMail(options);
  } catch (error) {
    console.error("Mail Error:", error);
    throw error;
  }
};

router.put('/admin/ticket/update/:id', async (req, res) => {
  try {
    const {
      status,
      devNote,
      delayReason,
      estimatedHours,
      actualHours,
      mailTo,
      mailCc,
      mailSubject,
      mailBody,
    } = req.body;
    const pool = await sql.connect(config);

    // Fetch existing ticket to preserve dev updates and delay history
    const existing = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT dev_note, delay_reason
        FROM support_tickets
        WHERE id = @id
      `);

    let dev = [];
    let delay = [];

    if (existing.recordset && existing.recordset[0]) {
      if (existing.recordset[0].dev_note) {
        try {
          dev = JSON.parse(existing.recordset[0].dev_note);
        } catch (e) {
          dev = [];
        }
      }
      if (existing.recordset[0].delay_reason) {
        try {
          delay = JSON.parse(existing.recordset[0].delay_reason);
        } catch (e) {
          delay = [];
        }
      }
    }

    const nextId = (dev.length > 0 || delay.length > 0)
      ? Math.max(
        ...(dev.length > 0 ? dev.map(u => u.id) : [0]),
        ...(delay.length > 0 ? delay.map(u => u.id) : [0])
      ) + 1
      : 1;

    dev.push({
      id: nextId,
      devNote,
      status: status,
      updateAt: new Date(),
    });

    delay.push({
      id: nextId,
      reason: delayReason,
      status: status,
      updateAt: new Date(),
    });

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.VarChar, status)
      .input('dev_note', sql.Text, JSON.stringify(dev) || null)
      .input('delay_reason', sql.Text, JSON.stringify(delay) || null)
      .input('estimated_hours', sql.Int, estimatedHours || null)
      .input('actual_hours', sql.Int, actualHours || null)
      .query(`
        UPDATE support_tickets
        SET
          status = @status,
          dev_note = @dev_note,
          delay_reason = @delay_reason,
          estimated_hours = @estimated_hours,
          actual_hours = @actual_hours,
          updated_at = GETDATE(),
          started_at = CASE WHEN @status = 'IN_PROGRESS' THEN GETDATE() ELSE started_at END,
          closed_at = CASE WHEN @status = 'CLOSED' THEN GETDATE() ELSE closed_at END
        WHERE id = @id
      `);

    if (status === 'CLOSED' && mailTo) {

      await sendMail({
        from: `"Tresume Support" <${process.env.EMAIL_USER}>`,
        to: mailTo,
        cc: mailCc || undefined,
        subject: mailSubject,
        html: `
      <div style="font-family:Arial; line-height:1.6">
        ${mailBody.replace(/\n/g, "<br>")}
      </div>
    `
      });

    }

    res.json({ success: true });

  } catch (err) {
    console.error('Ticket Update Error:', err);
    res.status(500).json({ success: false });
  }
});

router.get('/admin/report/range', async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and End date required'
      });
    }

    // 🔥 Convert to proper DateTime range
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    const pool = await sql.connect(config);

    /* ================= TICKETS ================= */
    const result = await pool.request()
      .input('startDate', sql.DateTime, start)
      .input('endDate', sql.DateTime, end)
      .query(`
        SELECT 
          ticket_code,
          issue_title,
          issue_description,
          category,
          status,
          rating,
          feedback,
          created_at,
          closed_at
        FROM support_tickets
        WHERE created_at BETWEEN @startDate AND @endDate
        ORDER BY created_at DESC
      `);

    /* ================= STATS ================= */
    const stats = await pool.request()
      .input('startDate', sql.DateTime, start)
      .input('endDate', sql.DateTime, end)
      .query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END) as openCount,
          SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed,
          AVG(CAST(rating as FLOAT)) as avgRating
        FROM support_tickets
        WHERE created_at BETWEEN @startDate AND @endDate
      `);

    res.json({
      success: true,
      tickets: result.recordset,
      stats: stats.recordset[0]
    });

  } catch (err) {
    console.error('Report Error:', err);  // 🔥 add this to see real error
    res.status(500).json({
      success: false,
      message: 'Report generation failed'
    });
  }
});


const ExcelJS = require('exceljs');
const { id } = require('date-fns/locale');

router.get('/admin/report/range/excel', async (req, res) => {

  const { startDate, endDate } = req.query;
  const pool = await sql.connect(config);

  const result = await pool.request()
    .input('startDate', sql.DateTime, startDate)
    .input('endDate', sql.DateTime, endDate)
    .query(`
      SELECT 
        ticket_code,
        issue_title,
        issue_description,
        category,
        status,
        rating,
        feedback,
        created_at,
        closed_at
      FROM support_tickets
      WHERE created_at BETWEEN @startDate AND @endDate
    `);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Date Range Report');

  worksheet.columns = [
    { header: 'Ticket Code', key: 'ticket_code', width: 20 },
    { header: 'Issue Title', key: 'issue_title', width: 30 },
    { header: 'Description', key: 'issue_description', width: 40 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Feedback', key: 'feedback', width: 30 },
    { header: 'Created At', key: 'created_at', width: 20 },
    { header: 'Closed At', key: 'closed_at', width: 20 }
  ];

  result.recordset.forEach(row => {
    worksheet.addRow(row);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Report_${startDate}_to_${endDate}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});

router.get('/chat/:ticketId', async (req, res) => {
  try {

    const { ticketId } = req.params;

    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT *
        FROM ticket_messages
        WHERE ticket_id = @ticketId
        ORDER BY created_at ASC
      `);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ success: false });
  }
});




router.get('/chat-users', async (req, res) => {
  try {

    const pool = await sql.connect(config);

    const result = await pool.request().query(`
    
SELECT *
FROM (
    SELECT 
        st.id AS ticketId,
        st.ticket_code,
        u.userId,
        u.firstName,
        u.email,

        -- 🔥 Last Message
        (
            SELECT TOP 1 message
            FROM ticket_messages tm2
            WHERE tm2.ticket_id = st.id
            ORDER BY tm2.created_at DESC
        ) AS lastMessage,

        -- 🔥 Last Message Time
        (
            SELECT TOP 1 created_at
            FROM ticket_messages tm3
            WHERE tm3.ticket_id = st.id
            ORDER BY tm3.created_at DESC
        ) AS lastMessageTime,

        -- ✅ ADD THIS (Unread Count)
        (
            SELECT COUNT(*)
            FROM ticket_messages tm4
            WHERE tm4.ticket_id = st.id
            AND tm4.sender_role = 'USER'
            AND tm4.status = 'sent'
        ) AS unreadCount,

        ROW_NUMBER() OVER (
            PARTITION BY u.userId 
            ORDER BY st.created_at DESC
        ) AS rn

    FROM support_tickets st
    JOIN users u ON u.userId = st.user_id
    WHERE st.status = 'IN_PROGRESS'
) x
WHERE x.rn = 1
ORDER BY lastMessageTime DESC

    `);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (err) {
    console.error('Chat Users Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load chat users'
    });
  }
});

// router.post('/pocupload', pocchatupload.single('file'), (req, res) => {
//   if (!req.file || !req.ticketId) {
//     console.error('File upload error: Missing file or ticketId', req.file, req.body);
//     return res.status(400).json({ success: false });
//   }

//   res.json({
//     success: true,
//     fileUrl: `/Overall_Document/pocchat_uploads/ticketid_${req.ticketId}/${req.file.filename}`,
//     fileType: req.file.mimetype
//   });
// });


// router.post('/pocupload', pocchatupload.single('file'), (req, res) => {

//   const ticketId = req.body.ticketId;

//   if (!ticketId) {
//     return res.status(400).json({ error: "ticketId is required" });
//   }

//   const ticketDir = path.join(
//     __dirname,
//     '..',
//     'tresume3-0',
//     'Overall_Document',
//     'pocchat_uploads',
//     `ticketid_${ticketId}`
//   );

//   fs.mkdirSync(ticketDir, { recursive: true });

//   // ✅ Generate unique filename
//   const savedFileName = Date.now() + path.extname(req.file.originalname);

//   const filePath = path.join(ticketDir, savedFileName);

//   fs.writeFileSync(filePath, req.file.buffer);

//   res.json({
//     success: true,
//     fileUrl: `/tresume3-0/Overall_Document/pocchat_uploads/ticketid_${ticketId}/${savedFileName}`,  // ✅ FIXED
//     fileType: req.file.mimetype
//   });
// });


router.post('/pocupload', pocchatupload.single('file'), async (req, res) => {
  try {

    const ticketId = req.body.ticketId;

    if (!ticketId || !req.file) {
      return res.status(400).json({ error: "Missing data" });
    }

    const result = await uploadChatFile(req.file, ticketId);

    res.json({
      success: true,
      fileUrl: result.url,
      fileType: result.fileType
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get('/chat-file', async (req, res) => {
  try {
    const fileUrl = req.query.url;

    console.log("CHAT FILE API HIT");

    const file = await getChatFileStream(fileUrl);

    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", "inline");

    file.stream.pipe(res);

  } catch (err) {
    console.error(" CHAT FILE ERROR:", err);
    res.status(500).send(err.message);
  }
});


module.exports = router;
