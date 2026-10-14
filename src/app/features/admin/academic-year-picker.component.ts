import { CommonModule } from '@angular/common';
import { Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-academic-year-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="year-picker">
      <button type="button" class="year-picker__trigger" [disabled]="disabled" [attr.aria-expanded]="open()"
        aria-haspopup="dialog" (click)="toggle()">
        {{ selectedYear() || 'Chọn năm học' }}
      </button>
      <section *ngIf="open()" class="year-picker__calendar" role="dialog" aria-label="Chọn năm học">
        <header class="year-picker__header">
          <button type="button" aria-label="10 năm trước" (click)="shiftDecade(-10)">‹</button>
          <strong>{{ decadeStart() }}–{{ decadeEnd() }}</strong>
          <button type="button" aria-label="10 năm sau" (click)="shiftDecade(10)">›</button>
        </header>
        <div class="year-picker__grid" role="grid">
          <button *ngFor="let year of years()" type="button" role="gridcell" [disabled]="disabled"
            [attr.aria-selected]="selectedYear() === year.toString()"
            [class.year-picker__year--selected]="selectedYear() === year.toString()"
            (click)="select(year)">{{ year }}</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .year-picker { position: relative; }
    .year-picker__trigger { width: 100%; min-height: 40px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #243b53; font: inherit; text-align: left; cursor: pointer; }
    .year-picker__trigger:focus-visible, .year-picker__calendar button:focus-visible { outline: 2px solid #80baf0; outline-offset: 2px; }
    .year-picker__calendar { position: absolute; z-index: 20; top: calc(100% + 5px); left: 0; width: min(100%, 280px); padding: 10px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; box-shadow: 0 8px 24px #17203324; }
    .year-picker__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: #263f59; }
    .year-picker__header button { width: 32px; height: 32px; border: 0; border-radius: 6px; background: #f1f5f9; color: #263f59; font-size: 20px; cursor: pointer; }
    .year-picker__grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
    .year-picker__grid button { min-height: 36px; border: 1px solid transparent; border-radius: 6px; background: #f8fafc; color: #344b62; font: inherit; cursor: pointer; }
    .year-picker__grid button:hover { border-color: #a9bfd7; background: #edf4fb; }
    .year-picker__grid button.year-picker__year--selected { border-color: #1457bd; background: #eaf2ff; color: #1457bd; font-weight: 700; }
  `],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AcademicYearPickerComponent), multi: true }]
})
export class AcademicYearPickerComponent implements ControlValueAccessor {
  readonly open = signal(false);
  readonly selectedYear = signal('');
  readonly decadeStart = signal(this.startOfDecade(new Date().getFullYear()));
  readonly decadeEnd = () => this.decadeStart() + 9;
  readonly years = () => Array.from({ length: 10 }, (_, index) => this.decadeStart() + index);
  disabled = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.selectedYear.set(value ?? '');
    const year = Number(value);
    if (Number.isInteger(year) && year >= 1900 && year <= 2199) this.decadeStart.set(this.startOfDecade(year));
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  toggle(): void {
    if (!this.disabled) this.open.update((value) => !value);
  }

  shiftDecade(offset: number): void {
    this.decadeStart.update((year) => Math.max(1900, Math.min(2190, year + offset)));
  }

  select(year: number): void {
    const value = year.toString();
    this.selectedYear.set(value);
    this.onChange(value);
    this.onTouched();
    this.open.set(false);
  }

  private startOfDecade(year: number): number {
    return Math.max(1900, Math.min(2190, Math.floor(year / 10) * 10));
  }
}
