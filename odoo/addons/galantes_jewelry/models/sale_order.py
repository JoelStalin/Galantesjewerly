from odoo import _, fields, models
from odoo.exceptions import UserError


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def _galantes_validate_payment_amount(self, invoices, stripe_payment):
        amount_cents = stripe_payment.get("amount")
        if not amount_cents:
            return

        invoice_total = sum(invoices.mapped("amount_total"))
        paid_total = float(amount_cents) / 100.0
        if abs(invoice_total - paid_total) > 0.01:
            raise UserError(
                _(
                    "Stripe paid amount (%s) does not match the Odoo invoice total (%s)."
                )
                % (paid_total, invoice_total)
            )

    def _galantes_pick_payment_journal(self):
        self.ensure_one()
        journal = self.env["account.journal"].search(
            [
                ("company_id", "=", self.company_id.id),
                ("type", "in", ["bank", "cash"]),
            ],
            limit=1,
        )
        if not journal:
            raise UserError(_("No bank or cash journal is configured for Stripe payment synchronization."))
        return journal

    def _galantes_pick_payment_method_line(self, journal):
        method_line = journal.inbound_payment_method_line_ids[:1]
        if not method_line:
            raise UserError(_("The selected payment journal has no inbound payment method configured."))
        return method_line

    def _galantes_register_invoice_payments(self, invoices, stripe_payment):
        for invoice in invoices.filtered(
            lambda move: move.move_type == "out_invoice"
            and move.state == "posted"
            and move.payment_state not in ("paid", "in_payment")
        ):
            journal = self._galantes_pick_payment_journal()
            method_line = self._galantes_pick_payment_method_line(journal)
            communication_parts = [invoice.name or _("Invoice")]
            payment_intent_id = stripe_payment.get("payment_intent_id")
            charge_id = stripe_payment.get("charge_id")

            if payment_intent_id:
                communication_parts.append(_("Stripe PI %s") % payment_intent_id)
            if charge_id:
                communication_parts.append(_("Charge %s") % charge_id)

            register = self.env["account.payment.register"].with_context(
                active_model="account.move",
                active_ids=invoice.ids,
            ).create(
                {
                    "payment_date": fields.Date.context_today(self),
                    "journal_id": journal.id,
                    "payment_method_line_id": method_line.id,
                    "amount": invoice.amount_residual,
                    "communication": " | ".join(communication_parts),
                }
            )
            register.action_create_payments()

    def _galantes_build_payment_message(self, stripe_payment):
        details = []
        if stripe_payment.get("payment_intent_id"):
            details.append(_("Stripe PaymentIntent: %s") % stripe_payment["payment_intent_id"])
        if stripe_payment.get("charge_id"):
            details.append(_("Stripe Charge: %s") % stripe_payment["charge_id"])
        if stripe_payment.get("receipt_url"):
            details.append(_("Stripe Receipt: %s") % stripe_payment["receipt_url"])
        if stripe_payment.get("customer_email"):
            details.append(_("Customer Email: %s") % stripe_payment["customer_email"])
        if stripe_payment.get("payment_status"):
            details.append(_("Stripe Status: %s") % stripe_payment["payment_status"])
        if stripe_payment.get("amount") and stripe_payment.get("currency"):
            details.append(
                _("Stripe Amount: %s %s")
                % (stripe_payment["amount"], str(stripe_payment["currency"]).upper())
            )

        return "<br/>".join(details) if details else _("Stripe payment synchronized.")

    def action_galantes_finalize_paid_checkout(self, stripe_payment=None):
        stripe_payment = stripe_payment or {}
        results = []

        for order in self:
            if order.state in ("draft", "sent"):
                order.action_confirm()
            elif order.state not in ("sale", "done"):
                raise UserError(
                    _("Order %s cannot be finalized from state %s.")
                    % (order.name, order.state or _("unknown"))
                )

            invoices = order.invoice_ids.filtered(lambda move: move.move_type == "out_invoice")
            if not invoices:
                invoices = order._create_invoices(final=True)

            draft_invoices = invoices.filtered(lambda move: move.state == "draft")
            if draft_invoices:
                draft_invoices.action_post()

            order._galantes_validate_payment_amount(invoices, stripe_payment)
            order._galantes_register_invoice_payments(invoices, stripe_payment)

            message = order._galantes_build_payment_message(stripe_payment)
            order.message_post(body=_("Stripe payment synchronized with Odoo.<br/>%s") % message)
            invoices.message_post(body=_("Stripe payment synchronized with Odoo.<br/>%s") % message)

            results.append(
                {
                    "order_id": order.id,
                    "invoice_ids": invoices.ids,
                    "picking_ids": order.picking_ids.ids,
                    "delivery_address": {
                        "name": order.partner_shipping_id.name,
                        "street": order.partner_shipping_id.street,
                        "street2": order.partner_shipping_id.street2,
                        "city": order.partner_shipping_id.city,
                        "zip": order.partner_shipping_id.zip,
                    },
                }
            )

        return results
