import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    try {
      // marked.parse returns string | Promise<string>; with default synchronous parser it returns string
      const rawHtml = marked.parse(value, { async: false }) as string;
      return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    } catch {
      return value;
    }
  }
}
