from odoo import _, fields, models
from odoo.exceptions import UserError


class AccountMove(models.Model):
    _inherit = "account.move"

    galantes_invoice_email_sent = fields.Boolean(
        string="Galantes Invoice Email Sent",
        default=False,
        copy=False,
    )
    galantes_invoice_email_sent_at = fields.Datetime(
        string="Galantes Invoice Email Sent At",
        copy=False,
    )
    galantes_invoice_email_message = fields.Char(
        string="Galantes Invoice Email Status",
        copy=False,
    )

    def _get_galantes_invoice_report(self):
        xmlids = [
            "account.account_invoices",
            "account.report_invoice_with_payments",
            "account.account_invoices_without_payment",
        ]

        for xmlid in xmlids:
            report = self.env.ref(xmlid, raise_if_not_found=False)
            if report:
                return report
        raise UserError(_("No invoice PDF report is available in this Odoo instance."))

    def _build_galantes_invoice_attachment(self):
        self.ensure_one()

        report = self._get_galantes_invoice_report()
        pdf_content, _content_type = report._render_qweb_pdf(self.ids)
        filename = f"{self.name or 'invoice'}.pdf"

        attachment = self.env["ir.attachment"].create(
            {
                "name": filename,
                "type": "binary",
                "datas": pdf_content,
                "res_model": self._name,
                "res_id": self.id,
                "mimetype": "application/pdf",
            }
        )
        return attachment

    def _build_galantes_invoice_mail_values(self, attachment):
        self.ensure_one()

        partner_name = self.partner_id.name or _("Customer")
        company_name = self.company_id.name or _("Galante's Jewelry")
        sender = self.company_id.email or self.env.user.email
        if not sender:
            raise UserError(
                _("The company email is not configured, so the invoice email cannot be sent.")
            )

        body_html = """
            <div>
                <p>%s %s,</p>
                <p>%s</p>
                <p><strong>%s:</strong> %s</p>
                <p>%s</p>
            </div>
        """ % (
            _("Hello"),
            partner_name,
            _("Attached is your invoice in PDF format."),
            _("Invoice"),
            self.name or _("Draft invoice"),
            _("Thank you for your purchase."),
        )

        return {
            "subject": _("%s - Invoice %s") % (company_name, self.name or ""),
            "body_html": body_html,
            "email_to": self.partner_id.email,
            "email_from": sender,
            "auto_delete": False,
            "attachment_ids": [(4, attachment.id)],
            "model": self._name,
            "res_id": self.id,
        }

    def action_send_invoice_pdf_email(self):
        Mail = self.env["mail.mail"]

        for move in self:
            if move.move_type != "out_invoice":
                continue
            if move.state != "posted":
                raise UserError(_("Only posted customer invoices can be emailed."))
            if not move.partner_id.email:
                raise UserError(_("The customer does not have an email address on file."))
            if move.galantes_invoice_email_sent:
                continue

            attachment = move._build_galantes_invoice_attachment()
            mail_values = move._build_galantes_invoice_mail_values(attachment)
            mail = Mail.create(mail_values)
            mail.send()

            move.write(
                {
                    "galantes_invoice_email_sent": True,
                    "galantes_invoice_email_sent_at": fields.Datetime.now(),
                    "galantes_invoice_email_message": _("Invoice email sent successfully."),
                }
            )
            move.message_post(
                body=_("Invoice email sent to %s with PDF attachment.") % move.partner_id.email
            )

        return True
