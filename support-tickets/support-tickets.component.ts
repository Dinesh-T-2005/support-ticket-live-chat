import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupportTicketsService } from './support-tickets.service';
import { EncryptedCookieService } from '../services/encrypted-cookie.service';
import { LoaderComponent } from 'src/app/loader/loader.component';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, LoaderComponent],
  templateUrl: './support-tickets.component.html',
  styleUrl: './support-tickets.component.scss'
})
export class SupportTicketsComponent {

  /* ---------------- STEP CONTROL ---------------- */
  step = 1;                 // 1 → issue, 2 → solution, 3 → final
  solved = false;           // step-3 state

  /* ---------------- FORM DATA ---------------- */
  ticket = {
    issueTitle: '',
    issueDescription: '',
    category: ''
  };

  additionalInfo = '';
  isLoading = false;

  /* ---------------- CATEGORY ---------------- */
  categories = [
    'Account',
    'AI Module',
    'Technical',
    'Feature Request',
    'Integration',
    'Other'
  ];

  /* ---------------- INSTRUCTION ---------------- */
  matchedVideo: string | null = null;
  instructionTitle = '';
  verified = false;

instructionMap = [
  {
    keywords: ['ai boolean', 'boolean', 'boolean query', 'boolean video'],
    title: 'AI Boolean Query Generation',
    video: 'assets/instructions/AI-Boolean.mp4'
  },
  {
    keywords: ['ai job description', 'job', 'job title', 'jd generator', 'ai jd'],
    title: 'AI Job Description Generator',
    video: 'assets/instructions/AI-JD.mp4'
  },
  {
    keywords: ['resume', 'resume parsing', 'ai resume', 'parse resume'],
    title: 'AI Resume Parsing',
    video: 'assets/instructions/AI-Parse.mp4'
  },
  {
    keywords: ['candidate scoring', 'ai scoring', 'score candidate'],
    title: 'AI Candidate Scoring',
    video: 'assets/instructions/AI-Scoring.mp4'
  },
  {
    keywords: ['twilio', 'ai twilio', 'calling', 'twilio workflow'],
    title: 'AI Twilio Calling',
    video: 'assets/instructions/AI-Twilio.mp4'
  },
  {
    keywords: ['interview decryptor', 'ai interview', 'decrypt interview'],
    title: 'AI Interview Decryptor',
    video: 'assets/instructions/AI-Interview.mp4'
  },
  {
    keywords: ['create department', 'department', 'add department'],
    title: 'How to Create a Department',
    video: 'assets/instructions/department.mp4'
  },
  {
    keywords: ['create job', 'add job', 'job creation', 'generate job'],
    title: 'How to Create a Job',
    video: 'assets/instructions/chatbotJob.mp4'
  },
  {
    keywords: ['add candidate', 'create candidate', 'candidate add', 'resume upload','candidate','candidate creation'],
    title: 'How to Add a Candidate',
    video: 'assets/instructions/addcandidate.mp4'
  },
  {
    keywords: ['assign candidate', 'assign job', 'job tracker assign'],
    title: 'How to Assign a Candidate to a Job',
    video: 'assets/instructions/assignJob.mp4'
  },
  {
    keywords: ['create group', 'group', 'candidate group'],
    title: 'How to Create a Group',
    video: 'assets/instructions/creategroups.mp4'
  },
  {
    keywords: ['schedule interview', 'interview schedule', 'book interview'],
    title: 'How to Schedule an Interview',
    video: 'assets/instructions/interviewschedule.mp4'
  },
  {
    keywords: ['move to placement', 'placement', 'candidate placement'],
    title: 'How to Move a Candidate to Placement',
    video: 'assets/instructions/placement.mp4'
  },
  {
    keywords: ['checklist', 'create checklist'],
    title: 'How to Create a Checklist',
    video: 'assets/instructions/checklist.mp4'
  },
  {
    keywords: ['onboard', 'onboarding', 'candidate onboarding'],
    title: 'How to Onboard a Candidate',
    video: 'assets/instructions/onboarding.mp4'
  }
];

  accesstype: any;
  orgid: any;
  orgdiv: any;
  recruiterid: any;
  email: any;

  constructor(private router: Router, private ticketService: SupportTicketsService, private encryptedCookieService: EncryptedCookieService, private toastr: ToastrService ) {
    this.accesstype = this.encryptedCookieService.getCookie('AccessType');
    this.orgid = this.encryptedCookieService.getCookie('orgId');
    this.orgdiv = this.encryptedCookieService.getCookie('divisionId');
    this.recruiterid = this.encryptedCookieService.getCookie('userId');
    this.email = this.encryptedCookieService.getCookie('email');
  }

  /* ---------------- STEP 1 ---------------- */
  selectCategory(cat: string) {
    this.ticket.category = cat;
  }

  canContinue(): boolean {
    return (
      this.ticket.issueTitle.trim().length > 3 &&
      this.ticket.issueDescription.trim().length > 10
    );
  }

  goToStep2() {
    this.matchInstruction();
    this.step = 2;
  }
onTitleChange() {
  const text = this.ticket.issueTitle.toLowerCase();

  const match = this.instructionMap.find(m =>
    m.keywords.some(keyword =>
      text.includes(keyword.toLowerCase())
    )
  );

  if (match) {
    this.matchedVideo = match.video;
    this.instructionTitle = match.title;
    this.verified = false;
  } else {
    this.matchedVideo = null;
    this.instructionTitle = '';
  }
}

// Helper to control video visibility
get showVideo(): boolean {
  return this.matchedVideo !== null && this.matchedVideo !== '';
}

  matchInstruction() {
    const text = this.ticket.issueTitle.toLowerCase();
    const match = this.instructionMap.find(m => m.keywords.some(keyword => text.includes(keyword.toLowerCase())));

    if (match) {
      this.matchedVideo = match.video;
      this.instructionTitle = match.title;
    } else {
      this.matchedVideo = null;
      this.instructionTitle = 'Suggested Solution';
    }

    this.verified = false;
  }

  /* ---------------- STEP 2 ---------------- */
  solvedIssue() {
    this.solved = true;
    this.step = 3;
  }

  issueStillPersists() {
    this.solved = false;
    this.step = 3;
  }

selectedFile: File | null = null;

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const selectedFile = input.files?.[0];
  
  if (selectedFile) {
    this.handleFile(selectedFile);  // Use existing method
  }
}

onDragOver(event: DragEvent) {
  event.preventDefault();
}

onDrop(event: DragEvent) {
  event.preventDefault();

  const file = event.dataTransfer?.files[0];
  
  if (file) {
    this.handleFile(file);  // ✅ Now TypeScript knows file is definitely a File
  }
}

handleFile(file: File) {
  if (!file) return;

  const maxSize = 20 * 1024 * 1024; // 20MB

  if (file.size > maxSize) {
    alert('File size should be less than 20MB');
    return;
  }

  this.selectedFile = file;
}


  /* ---------------- STEP 3 ---------------- */
  submitTicket() {
    this.isLoading = true;
    const formData = new FormData();

    formData.append('issueTitle', this.ticket.issueTitle);
    formData.append('issueDescription', this.ticket.issueDescription);
    formData.append('category', this.ticket.category);
    formData.append('instructionTitle', this.instructionTitle);
    formData.append('additionalInfo', this.additionalInfo);
    formData.append('userId', this.recruiterid);
    formData.append('orgId', this.orgid);
    formData.append('email', this.email);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile);
    }

    this.ticketService.createTicket(formData).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.toastr.success('Support ticket created successfully');
        this.step = 3;
        this.router.navigate(['/ats/ticket-list-view']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toastr.error('Failed to create support ticket', err?.error?.message || '');
      }
    });
  }



  backToDashboard() {
    this.router.navigate(['/ats/instructions']);
  }

  close() {
    this.router.navigate(['/ats/instructions']);
  }

  feedback: 'yes' | 'no' | null = null;

  onFeedback(type: 'yes' | 'no') {
    this.feedback = type;

    // optional: auto hide after 3 sec
    setTimeout(() => {
      this.feedback = null;
    }, 5000);
  }

}











