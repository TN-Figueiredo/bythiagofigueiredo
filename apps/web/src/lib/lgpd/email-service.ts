import type { IEmailService, EmailSender, EmailMessage } from '@tn-figueiredo/email';
import { emailLayout, emailButton, formatDatePtBR } from '@tn-figueiredo/email';
import type { ILgpdEmailService } from '@tn-figueiredo/lgpd/interfaces';

export interface BrevoLgpdEmailServiceOptions {
  /** Sender identity (noreply@domain). Caller resolves per-site branding. */
  sender: EmailSender;
  /** Brand + logo for the email layout. Optional — fallback uses sender.name. */
  branding?: {
    brandName?: string;
    primaryColor?: string;
    logoUrl?: string;
    siteUrl?: string;
  };
}

/**
 * LGPD email templates — inlined rather than imported from
 * `@tn-figueiredo/email/templates/*` because that package does not yet ship
 * LGPD templates (Sprint 4b only ships welcome/invite/contact/newsletter
 * helpers). We reuse the shared `emailLayout` / `emailButton` helpers so the
 * look-and-feel stays consistent with the rest of the product, and pt-BR
 * copy aligns with the privacy policy wording.
 *
 * Once @tn-figueiredo/email ships LGPD templates we can switch to
 * `sendTemplate()` + delete the inline strings.
 */
export class BrevoLgpdEmailService implements ILgpdEmailService {
  private readonly sender: EmailSender;
  private readonly branding: NonNullable<BrevoLgpdEmailServiceOptions['branding']>;

  constructor(
    private readonly inner: IEmailService,
    opts: BrevoLgpdEmailServiceOptions,
  ) {
    this.sender = opts.sender;
    this.branding = opts.branding ?? {};
  }

  private get brandName(): string {
    return this.branding.brandName ?? this.sender.name;
  }

  private async sendHtml(to: string, subject: string, bodyHtml: string): Promise<void> {
    const branding: { brandName: string; primaryColor?: string; logoUrl?: string } = {
      brandName: this.brandName,
    };
    if (this.branding.primaryColor) branding.primaryColor = this.branding.primaryColor;
    if (this.branding.logoUrl) branding.logoUrl = this.branding.logoUrl;
    const html = emailLayout({ body: bodyHtml, branding });
    const msg: EmailMessage = { from: this.sender, to, subject, html };
    await this.inner.send(msg);
  }

  async sendDeletionConfirmation(
    to: string,
    confirmUrl: string,
    expiresAt: Date,
    /**
     * P1-1 (Sprint 5a): optional dedicated cancel URL. When present, the
     * email offers a one-click abort link whose raw token is DIFFERENT
     * from the confirm token — so interception of the confirm link does
     * not trivially yield a cancel capability (and vice-versa).
     */
    cancelUrl?: string,
  ): Promise<void> {
    const expires = formatDatePtBR(expiresAt);
    const body = `
      <p>Recebemos uma solicitação para excluir a sua conta no ${this.brandName}.</p>
      <p>Para confirmar, clique no botão abaixo. O link expira em <strong>${expires}</strong>.</p>
      ${emailButton({ url: confirmUrl, label: 'Confirmar exclusão', ...(this.branding.primaryColor ? { color: this.branding.primaryColor } : {}) })}
      ${
        cancelUrl
          ? `<p style="margin-top: 24px;">Se você não solicitou, pode cancelar agora:</p>
      ${emailButton({ url: cancelUrl, label: 'Cancelar solicitação' })}`
          : ''
      }
      <p style="font-size: 13px; color: #666;">
        Se você não solicitou esta exclusão, ignore este email — nada será feito.
      </p>
    `;
    await this.sendHtml(to, 'Confirme a exclusão da sua conta', body);
  }

  async sendExportReady(to: string, downloadUrl: string, expiresAt: Date): Promise<void> {
    const expires = formatDatePtBR(expiresAt);
    const body = `
      <p>A sua exportação de dados está pronta (LGPD Art. 18 V — portabilidade).</p>
      <p>Faça o download abaixo. O link é válido até <strong>${expires}</strong>.</p>
      ${emailButton({ url: downloadUrl, label: 'Baixar meus dados', ...(this.branding.primaryColor ? { color: this.branding.primaryColor } : {}) })}
      <p style="font-size: 13px; color: #666;">
        O arquivo expira automaticamente para proteger os seus dados.
      </p>
    `;
    await this.sendHtml(to, 'Seus dados estão prontos para download', body);
  }

  async sendCleanupWarning(to: string, daysRemaining: number): Promise<void> {
    const body = `
      <p>Você tem <strong>${daysRemaining} dias</strong> até a sua conta ser removida por inatividade.</p>
      <p>Basta entrar no ${this.brandName} para cancelar a remoção automaticamente.</p>
    `;
    await this.sendHtml(
      to,
      `Aviso: sua conta será removida em ${daysRemaining} dias`,
      body,
    );
  }

  async sendCleanupFinalWarning(to: string): Promise<void> {
    const body = `
      <p>Esse é o <strong>último aviso</strong> antes de removermos a sua conta por inatividade prolongada.</p>
      <p>Entre agora para manter a sua conta ativa.</p>
    `;
    await this.sendHtml(to, 'Último aviso: sua conta será removida em breve', body);
  }

  async sendConsentRevocationConfirmation(to: string): Promise<void> {
    const body = `
      <p>Confirmamos a revogação do seu consentimento.</p>
      <p>A partir de agora, não usaremos mais os seus dados para as finalidades revogadas,
         respeitando as exceções legais (LGPD Art. 16).</p>
    `;
    await this.sendHtml(to, 'Consentimento revogado', body);
  }
}
