
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupportTicketsService } from '../support-tickets/support-tickets.service';
import { EncryptedCookieService } from '../services/encrypted-cookie.service';


@Component({
  selector: 'app-ticket-list-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-list-view.component.html',
  styleUrl: './ticket-list-view.component.scss'
})
export class TicketListViewComponent {

  tickets: any[] = [];
  loading = true;

  // 🔥 replace with real logged-in user id
  userId: any;

  constructor(
    private ticketService: SupportTicketsService,
    private encryptedCookieService: EncryptedCookieService,
    private router: Router,
  ) {
    this.userId = this.encryptedCookieService.getCookie('userId');
    
  }

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.ticketService.getMyTickets(this.userId).subscribe({
      next: (res: any) => {
        this.tickets = res.data || [];
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading tickets:', err);
        this.loading = false;
      }
    });
  }

  viewTicket(ticketId: number) {


     const payload = { ticketId };
    this.router.navigate(['/ats/ticket-view', ticketId], { state: payload });
    console.log('Viewing ticket:', ticketId , 'Payload:', payload);
  }
}
