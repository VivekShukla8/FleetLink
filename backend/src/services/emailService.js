// ─────────────────────────────────────────────────────────
// Email Service — Resend API integration
// ─────────────────────────────────────────────────────────
//
// Sends transactional emails via Resend (resend.com).
// Currently handles booking confirmation emails only.
//
// The "from" address uses Resend's shared domain for dev/testing.
// For production, you'd verify your own domain (e.g., noreply@fleetlink.in)
// in the Resend dashboard.

const { Resend } = require('resend');

let resend = null;

function getResendClient() {
  if (resend) return resend;

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_PASTE_YOUR_KEY_HERE') {
    throw new Error('RESEND_API_KEY not configured — set it in .env');
  }

  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// Resend's free-tier shared domain — works without domain verification
const FROM_ADDRESS = 'FleetLink <onboarding@resend.dev>';

/**
 * Sends a booking confirmation email to the customer.
 *
 * @param {object} data - Booking details from the RabbitMQ message
 * @param {string} data.bookingId
 * @param {string} data.userEmail
 * @param {string} data.userName
 * @param {string} data.brand
 * @param {string} data.model
 * @param {string} data.category
 * @param {string} data.startDate
 * @param {string} data.endDate
 * @param {string} data.totalPrice
 * @param {string} data.deposit
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendBookingConfirmationEmail(data) {
  const {
    bookingId, userEmail, userName,
    brand, model, category,
    startDate, endDate, totalPrice, deposit,
  } = data;

  // Format dates for display (e.g., "20 Sep 2026")
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">
          🚗 FleetLink
        </h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
          Booking Confirmed
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        
        <p style="font-size: 16px; color: #1f2937; margin: 0 0 24px;">
          Hi <strong>${userName}</strong>,
        </p>
        
        <p style="font-size: 15px; color: #374151; margin: 0 0 24px; line-height: 1.6;">
          Your booking has been <span style="color: #059669; font-weight: 600;">confirmed</span>! 
          Here are the details:
        </p>

        <!-- Booking Details Card -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Booking ID</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 500; text-align: right;">
                <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                  ${bookingId.slice(0, 8)}…
                </code>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Vehicle</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">
                ${brand} ${model} <span style="color: #6b7280;">(${category})</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Pickup Date</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">
                ${fmtDate(startDate)}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Return Date</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">
                ${fmtDate(endDate)}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; border-top: 1px solid #e5e7eb;">Security Deposit</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">
                ₹${parseFloat(deposit).toLocaleString('en-IN')}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 8px; color: #6b7280; border-top: 2px solid #d1d5db; font-weight: 600;">
                Total Paid
              </td>
              <td style="padding: 12px 0 8px; color: #059669; font-weight: 700; text-align: right; border-top: 2px solid #d1d5db; font-size: 18px;">
                ₹${parseFloat(totalPrice).toLocaleString('en-IN')}
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #9ca3af; margin: 0; line-height: 1.6;">
          Please carry a valid government ID for verification at pickup.
          For any changes, visit your bookings dashboard or contact the store.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">
          © ${new Date().getFullYear()} FleetLink — Vehicle Rental Platform
        </p>
      </div>
    </div>
  `;

  try {
    const { data: result, error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to: [userEmail],
      subject: `✅ Booking Confirmed — ${brand} ${model}`,
      html,
    });

    if (error) {
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    console.log(`📧 Email sent to ${userEmail} (Resend ID: ${result.id})`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendBookingConfirmationEmail };
