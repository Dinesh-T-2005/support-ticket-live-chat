import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'root'
})
export class SupportTicketsService {
  private apiUrl = environment.apiUrl; // backend base URL

  constructor(private http: HttpClient) { }




  /* ---------------- CREATE TICKET ---------------- */
  createTicket(formData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}supportticket/ticket`, formData);
  }


  getMyTickets(userId: any) {
    return this.http.get<any>(`${this.apiUrl}supportticket/user/tickets/${userId}`);
  }

  getTicketDetail(ticketId: number) {
    return this.http.get<any>(`${this.apiUrl}supportticket/user/tickets/detail/${ticketId}`);
  }

  submitFeedback(ticketId: number, payload: any) {
    return this.http.post<any>(
      `${this.apiUrl}supportticket/user/tickets/${ticketId}/feedback`,
      payload
    );
  }

  getDashboardStats() {
    return this.http.get<any>(`${this.apiUrl}supportticket/admin/dashboard`);
  }

  getFilteredTickets(status: string) {
    return this.http.get<any>(
      `${this.apiUrl}supportticket/admin/tickets?status=${status}`
    );
  }

  getRatings() {
    return this.http.get<any>(
      `${this.apiUrl}supportticket/admin/ratings`
    );
  }

  getSingleTicket(id: number) {
    return this.http.get<any>(
      `${this.apiUrl}supportticket/admin/ticket/${id}`
    );
  }

  updateTicket(id: number, data: any) {
    return this.http.put<any>(
      `${this.apiUrl}supportticket/admin/ticket/update/${id}`,
      data
    );
  }

  getRangeReport(start: string, end: string) {
    return this.http.get<any>(
      `${this.apiUrl}supportticket/admin/report/range?startDate=${start}&endDate=${end}`
    );
  }

  downloadRangeExcel(start: string, end: string) {
    return this.http.get(
      `${this.apiUrl}supportticket/admin/report/range/excel?startDate=${start}&endDate=${end}`,
      { responseType: 'blob' }
    );
  }




}
