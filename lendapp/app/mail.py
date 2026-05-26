import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = os.getenv("MAIL_USER", "")
SMTP_PASS = os.getenv("MAIL_PASS", "")
APP_URL = os.getenv("APP_URL", "https://lendapp.haasenheim.com")


def _send(to: str, subject: str, html: str):
    if not SMTP_USER or not SMTP_PASS:
        print(f"[MAIL] Nicht konfiguriert – Mail an {to} nicht gesendet")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"LendApp <{SMTP_USER}>"
        msg["To"] = to

        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, to, msg.as_string())

        print(f"[MAIL] Gesendet an {to}: {subject}")

    except Exception as e:
        print(f"[MAIL] Fehler beim Senden an {to}: {e}")


def _base(content: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#f5f3ee;padding:32px;border-radius:16px">
      <div style="background:#1C1A16;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <span style="color:#7CFF6B;font-size:22px;font-weight:700">LendApp</span>
        <span style="color:#666;font-size:12px;margin-left:12px">Ausleihen leicht gemacht</span>
      </div>

      {content}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">
        <a href="{APP_URL}" style="color:#3B6D11">App öffnen</a>
        &nbsp;·&nbsp; LendApp
      </div>
    </div>
    """


def mail_new_booking(
    owner_email: str,
    owner_name: str,
    borrower_name: str,
    item_name: str,
    date_from: str,
    date_to: str,
    note: str = "",
):
    content = f"""
    <h2 style="color:#1C1A16;margin:0 0 8px">
      📬 Neue Buchungsanfrage
    </h2>

    <p style="color:#555;margin:0 0 20px">
      Hallo {owner_name}, jemand möchte etwas von dir ausleihen.
    </p>

    <div style="background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">GEGENSTAND</span><br>
        <strong style="font-size:16px">{item_name}</strong>
      </div>

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">VON</span><br>
        <strong>{borrower_name}</strong>
      </div>

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">ZEITRAUM</span><br>
        <strong>{date_from} – {date_to}</strong>
      </div>

      {
        "<div><span style='color:#999;font-size:12px'>NACHRICHT</span><br><em>"
        + note +
        "</em></div>"
        if note else ""
      }
    </div>

    <a href="{APP_URL}"
       style="display:inline-block;background:#2D5016;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
       Jetzt genehmigen oder ablehnen →
    </a>
    """

    _send(
        owner_email,
        f'📬 {borrower_name} möchte „{item_name}” ausleihen',
        _base(content),
    )


def mail_booking_approved(
    borrower_email: str,
    borrower_name: str,
    item_name: str,
    owner_name: str,
    date_from: str,
    date_to: str,
):
    content = f"""
    <h2 style="color:#1C1A16;margin:0 0 8px">
      ✅ Buchung genehmigt!
    </h2>

    <p style="color:#555;margin:0 0 20px">
      Hallo {borrower_name}, deine Anfrage wurde genehmigt.
    </p>

    <div style="background:#EAF3DE;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #2D5016">

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">GEGENSTAND</span><br>
        <strong style="font-size:16px">{item_name}</strong>
      </div>

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">BESITZER</span><br>
        <strong>{owner_name}</strong>
      </div>

      <div>
        <span style="color:#999;font-size:12px">ZEITRAUM</span><br>
        <strong>{date_from} – {date_to}</strong>
      </div>
    </div>

    <p style="color:#555;font-size:13px">
      Bitte denk daran den Gegenstand bis
      <strong>{date_to}</strong> zurückzugeben.
    </p>

    <a href="{APP_URL}"
       style="display:inline-block;background:#2D5016;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
       App öffnen →
    </a>
    """

    _send(
        borrower_email,
        f'✅ Buchung für „{item_name}” genehmigt',
        _base(content),
    )


def mail_booking_rejected(
    borrower_email: str,
    borrower_name: str,
    item_name: str,
    owner_name: str,
):
    content = f"""
    <h2 style="color:#1C1A16;margin:0 0 8px">
      ❌ Buchung abgelehnt
    </h2>

    <p style="color:#555;margin:0 0 20px">
      Hallo {borrower_name}, leider wurde deine Anfrage abgelehnt.
    </p>

    <div style="background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:20px">

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">GEGENSTAND</span><br>
        <strong style="font-size:16px">{item_name}</strong>
      </div>

      <div>
        <span style="color:#999;font-size:12px">BESITZER</span><br>
        <strong>{owner_name}</strong>
      </div>
    </div>

    <p style="color:#555;font-size:13px">
      Kontaktiere {owner_name} direkt falls du Fragen hast.
    </p>

    <a href="{APP_URL}"
       style="display:inline-block;background:#1C1A16;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
       Andere Gegenstände ansehen →
    </a>
    """

    _send(
        borrower_email,
        f'❌ Buchungsanfrage für „{item_name}” abgelehnt',
        _base(content),
    )


def mail_return_reminder(
    borrower_email: str,
    borrower_name: str,
    item_name: str,
    owner_name: str,
    date_to: str,
):
    content = f"""
    <h2 style="color:#1C1A16;margin:0 0 8px">
      ⏰ Rückgabe morgen
    </h2>

    <p style="color:#555;margin:0 0 20px">
      Hallo {borrower_name}, nur eine kurze Erinnerung!
    </p>

    <div style="background:#FAEBD7;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #854F0B">

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">GEGENSTAND</span><br>
        <strong style="font-size:16px">{item_name}</strong>
      </div>

      <div style="margin-bottom:10px">
        <span style="color:#999;font-size:12px">ZURÜCK AN</span><br>
        <strong>{owner_name}</strong>
      </div>

      <div>
        <span style="color:#999;font-size:12px">RÜCKGABE BIS</span><br>
        <strong style="color:#854F0B">{date_to}</strong>
      </div>
    </div>

    <a href="{APP_URL}"
       style="display:inline-block;background:#854F0B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
       Rückgabe bestätigen →
    </a>
    """

    _send(
        borrower_email,
        f'⏰ Erinnerung: „{item_name}” morgen zurückgeben',
        _base(content),
    )
