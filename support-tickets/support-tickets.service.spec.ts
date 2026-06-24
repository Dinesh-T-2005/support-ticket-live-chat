import { TestBed } from '@angular/core/testing';

import { SupportTicketsService } from './support-tickets.service';

describe('SupportTicketsService', () => {
  let service: SupportTicketsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupportTicketsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
