import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportTicketsService } from '../support-tickets/support-tickets.service';
import { SocketService } from '../services/socket.service';
import { EncryptedCookieService } from '../services/encrypted-cookie.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { environment } from 'src/environments/environment';





@Component({
  selector: 'app-ticket-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-view.component.html',
  styleUrl: './ticket-view.component.scss'
})
export class TicketViewComponent implements AfterViewChecked, OnInit {

  ticket: number | any;
  rating = 0;
  feedback = '';
  loading = true;

  data: any;
  ticketId!: number;
  message = '';
  messages: any[] = [];
  userId: any;
  senderName: any;
  role: any;
  // Prevent repeated "start time in the future" warnings
  private warnedFutureStart = false;
  selectedFile: File | null = null;
  attachmentUrl: string | null = null;
  fileType: string | null = null;
  apiUrl: string = environment.apiUrl.replace(/\/$/, '');
  private lastMessageCount = 0;

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private ticketService: SupportTicketsService,
    private chatService: SocketService,
    private cookie: EncryptedCookieService,
    private sanitizer: DomSanitizer
  ) {
    this.userId = Number(this.cookie.getCookie('userId'));
    this.senderName = this.cookie.getCookie('firstName');
    this.role = this.cookie.getCookie('AccessType') || 'USER';
  }

  ngOnInit() {

    // subscribe first
    this.chatService.messages$.subscribe(msgs => {
      this.messages = msgs;
      if (!this.isChatOpen && msgs.length) {
        this.unreadCount++;
      }
    });

    this.data = history.state;

    const ticketId = this.data?.ticketId;



    if (ticketId) {
      this.ticketId = Number(ticketId);
    }

    this.chatService.connect(
      this.userId,
      String(this.cookie.getCookie('email')),
      String(this.role),
      Number(this.cookie.getCookie('orgId')),
      String(this.cookie.getCookie('divisionId'))
    );



    // load ticket
    if (this.ticketId) {
      this.loadTicket(this.ticketId);

      this.chatService.joinTicketRoom(this.ticketId);

      this.chatService.loadMessages(this.ticketId)
        .subscribe((res: any) => {
          const msgs = res.data || [];
          this.chatService.chatMessages$.next(msgs);
          // Diagnostic: force mark unread messages as read to verify flow
          msgs.forEach((m: any) => {
            if (m.sender_id !== this.userId && m.status !== 'read') {
              // console.log('Diagnostic: forcing markAsRead for message', m.id);
              this.chatService.markAsRead(m);
            }
          });
        });
    }
  }

  ngAfterViewChecked() {
    if (this.messages.length !== this.lastMessageCount) {
      this.lastMessageCount = this.messages.length;
      this.scrollToBottom();
    }
  }
  scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.chatContainer.nativeElement.scrollTo({
          top: this.chatContainer.nativeElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    } catch (err) { }
  }

  loadTicket(ticketId: number) {
    this.ticketService.getTicketDetail(ticketId).subscribe(res => {

      this.ticket = res.data;

      /* -------- PARSE DEV NOTE -------- */
      try {
        this.ticket.dev_updates =
          this.ticket.dev_note ? JSON.parse(this.ticket.dev_note) : [];
      } catch (e) {
        this.ticket.dev_updates = [];
        console.warn('Failed to parse dev_note JSON', e);
      }

      /* -------- PARSE DELAY -------- */
      try {
        this.ticket.delay_updates =
          this.ticket.delay_reason ? JSON.parse(this.ticket.delay_reason) : [];
      } catch (e) {
        this.ticket.delay_updates = [];
        console.warn('Failed to parse delay_reason JSON', e);
      }

      /* -------- REVERSE AFTER PARSE -------- */
      if (this.ticket.dev_updates.length) {
        this.ticket.dev_updates = [...this.ticket.dev_updates].reverse();
      }

      if (this.ticket.delay_updates.length) {
        this.ticket.delay_updates = [...this.ticket.delay_updates].reverse();
      }

      // console.log('Loaded ticket:', this.ticket);

      // reset one-time warning for this ticket load
      this.warnedFutureStart = false;

      this.loading = false;
    });
  }

  submitFeedback() {
    if (!this.rating || !this.feedback.trim()) {
      alert('Please give rating and feedback');
      return;
    }

    this.ticketService.submitFeedback(this.ticket.id, {
      rating: this.rating,
      feedback: this.feedback
    }).subscribe(() => {
      this.ticket.rating = this.rating;
      this.ticket.feedback = this.feedback;
    });
  }

  getLiveDuration() {
    if (!this.ticket.started_at) return null;

    const start = new Date(this.ticket.started_at).getTime();
    const end = this.ticket.status === 'CLOSED'
      ? new Date(this.ticket.closed_at).getTime()
      : new Date().getTime();

    let diffMs = end - start;

    // If start time is in the future, it's likely a timezone issue — clamp to 0
    if (diffMs < 0) {
      if (!this.warnedFutureStart) {
        console.warn('Start time is in the future. Check timezone settings.');
      }
      this.warnedFutureStart = true;
      diffMs = 0;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

    return `${hours}h ${minutes}m`;
  }
  onFileSelect(event: any) {

    const file = event.target.files?.[0];
    if (!file) return;

    this.selectedFile = file;
    this.ticketId = this.ticketId || this.data?.ticketId;

    this.chatService.uploadFile(file, this.ticketId)
      .subscribe({
        next: (res: any) => {
          this.attachmentUrl = res.fileUrl;
          this.fileType = res.fileType;
        },
        error: (err) => {
          console.error('Upload failed', err);
        }
      });
  }

  removeFile() {
    this.selectedFile = null;
    this.attachmentUrl = null;
    this.fileType = null;
  }



  getSafeUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.apiUrl + '/supportticket/chat-file?url=' + url
    );
  }

  send() {

    if (!this.message && !this.attachmentUrl) return;

    this.chatService.sendTicketMessage({
      ticketId: this.ticketId,
      senderId: this.userId,
      senderName: this.senderName,
      role: 'USER',
      message: this.message,
      attachment: this.attachmentUrl,
      fileType: this.fileType
    });

    this.message = '';
    this.selectedFile = null;
    this.attachmentUrl = null;
    this.fileType = null;
  }

  isChatOpen = false;
  unreadCount = 0;

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;

    if (this.isChatOpen) {
      this.unreadCount = 0;
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }
  selectedImage: string | null = null;
  selectedVideo: string | null = null;

  openImage(url: string) {
    this.selectedImage = url;
  }

  closeImage() {
    this.selectedImage = null;
  }

  openVideo(url: string) {
    this.selectedVideo = url;
  }

  closeVideo() {
    this.selectedVideo = null;
  }

}
