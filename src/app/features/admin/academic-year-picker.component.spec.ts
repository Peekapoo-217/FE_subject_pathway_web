import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { AcademicYearPickerComponent } from './academic-year-picker.component';

@Component({
  standalone: true,
  imports: [FormsModule, AcademicYearPickerComponent],
  template: '<app-academic-year-picker [(ngModel)]="year" name="year"></app-academic-year-picker>'
})
class YearPickerHostComponent { year = ''; }

describe('AcademicYearPickerComponent', () => {
  let fixture: ComponentFixture<YearPickerHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearPickerHostComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();
    fixture = TestBed.createComponent(YearPickerHostComponent);
    fixture.detectChanges();
  });

  it('selects a calendar year and writes a four digit year to the form', () => {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.year-picker__trigger')?.click();
    fixture.detectChanges();
    const yearButton = Array.from(root.querySelectorAll<HTMLButtonElement>('.year-picker__grid button'))
      .find((button) => button.textContent?.trim() === '2026');
    yearButton?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.year).toBe('2026');
    expect(root.querySelector('.year-picker__trigger')?.textContent).toContain('2026');
  });

  it('moves between decade ranges', () => {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.year-picker__trigger')?.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[aria-label="10 năm sau"]')?.click();
    fixture.detectChanges();
    expect(root.querySelector('.year-picker__header strong')?.textContent).toContain('2030');
  });
});
