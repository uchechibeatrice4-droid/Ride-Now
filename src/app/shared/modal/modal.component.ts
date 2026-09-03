import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css']
})
export class ModalComponent {

  @Input() show = false;
  @Input() title = '';
  @Input() message = '';
  @Input() type: 'success' | 'error' | 'confirm' = 'success';

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  closeModal() {
    this.close.emit();
  }

  confirmAction() {
    this.confirm.emit();
  }
}