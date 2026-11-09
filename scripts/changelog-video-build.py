#!/usr/bin/env python3
"""Build a Change Log video for the Vident Hub (not the Y? Hub).

Usage:
  python3 scripts/changelog-video-build.py <key> --shots <dir> --wavs <dir> --fonts <dir> --out <dir>

key is one of: aug, sep, oct, nov, leads, av
Inputs:
  shots/<page>.jpg   masked Hub screenshots (1348x896; top 1348x842 is used)
  wavs/<key>-N.wav   HeyGen voice takes, one per scene (spoken name is "Vydent")
Output:
  <out>/<OUTNAMES[key]>  (1920x1080, black title bar with bronze brand text, bronze highlight,
                          burned-in captions)
Needs: Pillow, ffmpeg, Inter-Bold.otf + Inter-SemiBold.otf in --fonts. Keep SCENES in sync with
docs/changelog-videos/README.md.
"""
import argparse, os, re, subprocess, sys, wave
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
BRONZE, BG, BAR = (201, 160, 92), (14, 14, 14), (8, 8, 8)
TITLE_H, CAP_H = 100, 150
CROP_W, CROP_H = 1348, 842
PAD_END = 0.6

OUTNAMES = {
    "aug": "changelog-2026-08.mp4", "sep": "changelog-2026-09.mp4",
    "oct": "changelog-2026-10.mp4", "nov": "changelog-2026-11.mp4",
    "leads": "changelog-leads-2026-11.mp4", "av": "changelog-av-2026-11.mp4",
    "honeybook": "honeybook-v8.mp4", "honeybook_v9": "honeybook-v9.mp4",
    "estimates": "estimates.mp4", "services_v2": "services-v2.mp4",
    "services": "services.mp4", "checklist": "event-checklist.mp4", "scheduling": "scheduling.mp4", "quickbooks": "quickbooks.mp4",
}
K = 1348 / 1372  # new how-to shots are 1372x896 captures; the prep step scales them to 1348 wide


def S(*r):
    """Rect in 1372-wide capture coordinates -> scaled shot coordinates."""
    return tuple(round(v * K) for v in r)


def G(*r):
    """Rect in 1273-wide browser coordinates -> scaled shot coordinates (checklist shots)."""
    return tuple(round(v * 1348 / 1273) for v in r)


CL = (427, 150, 1145, 200)  # What's New page heading

# (image, [highlight rects in screenshot coords], title bar topic, spoken text)
SCENES = {
 "aug": [
  ("changelog", [(427, 150, 1065, 245)], "What's New in August", "Here's what's new in the Vydent Hub for August."),
  ("home_admin", [(1103, 57, 1238, 80), (1245, 57, 1333, 80)], "Team huddle", "Start a team huddle from the top of Home. Zoom recordings show up in Meetings after Zoom finishes processing them."),
  ("forum", [(262, 500, 460, 568)], "Forum", "In Forum, use Hub Bugs to report anything broken, and Hub Wishlist to pitch ideas for the Hub."),
  ("notifications", [(1048, 8, 1092, 44)], "Notifications", "If you've added the Hub to your phone's home screen, the app icon now shows how many notifications you haven't read."),
  ("ask", [(427, 355, 1145, 395)], "Ask the Hub", "Ask the Hub answers questions about Hub features and company info reliably again. Just ask in plain English."),
  ("changelog", [(427, 210, 570, 245)], "What's New", "And this page, What's New, keeps a running log of every change. When there is something you haven't seen, the link shows a New tag. Stay focused!"),
 ],
 "sep": [
  ("changelog", [(427, 150, 1065, 245)], "What's New in September", "Here's what's new in the Vydent Hub for September."),
  ("photos", [(307, 725, 1265, 842)], "Event photos", "Event photo galleries now load much faster. They show light thumbnails, and new uploads are sized automatically. Click any photo to see it full size."),
  ("action", [(447, 408, 1015, 442)], "Action Center", "A task can now be assigned to more than one person, and each person checks off their own part. Everyone on a task can leave comments, and the others get notified."),
  ("changelog", [(427, 150, 1145, 200)], "PLAUD removed", "The PLAUD recordings module has been removed from the Hub. Zoom meeting recordings still live in Meetings. Stay focused!"),
 ],
 "oct": [
  ("changelog", [(427, 150, 1065, 245)], "What's New in October", "Here's what's new in the Vydent Hub for October."),
  ("resources", [(1078, 172, 1206, 208)], "Resources", "Any staff member can now add a resource. Open Resources, press Add resource, choose a link or a file, and pick who can see it."),
  ("home", [(12, 8, 164, 42), (307, 185, 1265, 330)], "A new look", "The Hub has a new look. The updated Vydent wordmark and monogram are in, and buttons and links now follow the charcoal black and bronze of the logo."),
  ("tools", [(11, 342, 212, 376), (254, 530, 1320, 840)], "Tools", "The sidebar is shorter now. Click Tools to see every Hub tool grouped by what you're doing, each with a short description."),
  ("home", [(365, 420, 1210, 512), (1155, 392, 1237, 414)], "Home shortcuts", "On Home, your pinned shortcuts are big icon tiles, and a Needs your attention row shows what's waiting on you. Use Customize to choose your quick tools."),
  ("tools", [(254, 245, 793, 286)], "Tools search", "Tools also has a search box at the top. Type a name, like warehouse or points, to jump straight to it. Stay focused!"),
 ],
 "nov": [
  ("changelog", [(427, 150, 1065, 245)], "What's New in November", "Here's what's new in the Vydent Hub so far in November."),
  ("home", [(307, 155, 1265, 300)], "Holiday themes", "On sixteen holidays, from New Year's Day to Christmas, the whole Hub changes into a holiday theme. There's nothing to turn on. The Vydent logo always stays."),
  ("packets", [(367, 404, 1205, 470)], "Wedding event packets", "Wedding Event Packets now have a day-of checklist. It covers times, power, mics, dances, and consent, so nothing gets missed."),
  ("teams", [(254, 230, 758, 270)], "Teams", "Teams now shows planning links for your department until your lead adds custom ones."),
  ("training", [(367, 598, 1205, 716)], "How-to videos", "How-to videos are in the Training Portal, starting with Event Packets. Each video is worth five points, and finishing them earns a hundred-point bonus. Stay focused!"),
 ],
 "leads": [
  ("honeybook", [(254, 185, 700, 260)], "What's new for Leads", "Here's what's new for Leads in the Vydent Hub."),
  ("honeybook", [(254, 465, 1320, 497)], "HoneyBook projects board", "The HoneyBook Projects board has a column for each stage. Drag a column header to reorder, and empty stages stay hidden."),
  ("honeybook", [(273, 580, 474, 684)], "Project lead and support", "Each project page has a project lead and support staff. Assign staff there. Only admins and assigned staff can make changes."),
  ("honeybook", [(263, 505, 485, 697), (553, 415, 650, 450)], "Client link", "Share a client link so your client can fill out the planning questionnaire and upload files. Staff can read the answers and download the files."),
  ("staffing", [(307, 330, 1265, 645)], "Staffing", "In Staffing, you can see which events still need crew, and Leads can mark or clear unavailable days. There's an AV crew link too. Stay focused!"),
 ],
 "av": [
  ("quotes", [(265, 188, 1300, 256)], "What's new for Vident AV", "Here's what's new for the Vydent AV team since late October."),
  ("quotes", [(307, 282, 890, 330), (1154, 282, 1265, 315)], "Quotes", "The Hub now owns your catalog, customers, venues, and quotes. Current RMS has been retired."),
  ("quotes", [(307, 400, 1265, 535)], "Estimates", "Estimates go out as a private link or PDF. Clients can sign with a drawn signature, and change orders are supported."),
  ("warehouse", [(700, 188, 796, 224), (307, 745, 1265, 842)], "Warehouse, Costs and Crew", "In Warehouse, check gear out and back in. Costs show your margin, and Crew shows day rates."),
  ("invoices", [(367, 342, 1100, 376), (367, 435, 1205, 492)], "Invoices", "Invoices start as drafts you can edit before you press Mark sent. They handle sales tax, payments, and credit notes, send a pay link by email, and remind clients about overdue balances."),
  ("portals", [(307, 185, 1265, 240)], "AV Event Portals", "AV Event Portals give each client a private link, and check-in emails go out at thirty, fourteen, seven, and three days before the event."),
  ("show", [(367, 185, 1205, 560)], "AV Show Control", "Show Control runs full-screen graphics, lower thirds, and a stage timer, with a phone remote. Stay focused!"),
 ],
 # How-to videos for the Nov 2026 modules. Shots (1372x896 captures scaled to 1348 wide on a 1348x896 canvas by the prep step; rects use S(...) in capture coordinates):
 # hb_overview, hb_proj, hb_cards, hb_archive, hb_reports, hb_auto, svc_list, svc_search, svc_add, sch_list, sch_form, sch_cal, sch_slots, qb
 "honeybook": [
  ("hb_overview", [S(860, 229, 1316, 291)], "HoneyBook", "HoneyBook in the Vydent Hub keeps your clients, projects, and payments in one place. Along the top you will find the newest tools."),
  ("hb_proj", [S(471, 200, 1140, 380)], "Project page", "Open any project, and everything for that client is on one page, from emails and contracts to invoices and floor plans."),
  ("hb_cards", [S(491, 122, 1120, 150)], "Email client", "In Email client, press Write an email, pick a template, check the message, and send. Each email is saved in Notes and trail."),
  ("hb_cards", [S(471, 196, 1140, 386)], "Contracts", "In Contracts, pick a template, press New contract, and edit the wording. Then Send for signature. The client signs on their phone, and the signed PDF lands here."),
  ("hb_cards", [S(471, 411, 1140, 522)], "Invoices", "In Invoices, press New invoice, add services from the catalog, and choose a payment plan. Clients pay by card from the link. Checks and cash go in with Record payment."),
  ("hb_proj", [S(471, 348, 560, 382)], "Client portal", "Share link gives the client one private page with their contracts, invoices, and booking links. They need no sign in."),
  ("hb_archive", [S(404, 320, 1207, 525)], "Archive and backup", "Archive and backup files your old HoneyBook documents on their projects. Admins can also download spreadsheet backups."),
  ("hb_reports", [S(295, 288, 1316, 390)], "Sales reports", "Sales reports show how many leads turn into booked events, your booking rate, and where your leads come from."),
  ("hb_auto", [S(440, 325, 1188, 350), S(1126, 325, 1172, 345)], "Email automations", "Email automations send a thank you, a check-in, and a proposal nudge for you. Each one starts Off, so you choose what to turn on. Stay focused!"),
 ],
 "services": [
  ("svc_list", [S(295, 160, 1316, 215)], "Services Catalog", "The Services Catalog is your saved list of services and prices, ready to drop into invoices and proposals. You will find it under Tools."),
  ("svc_list", [S(295, 262, 440, 286), S(295, 300, 1316, 420)], "Look things up", "Everyone on staff can look things up. It holds one hundred thirty-five services from HoneyBook, sorted into categories."),
  ("svc_search", [S(295, 222, 722, 254), S(295, 295, 1316, 757)], "Search", "Type in the search box to find one fast. Try linen, and you get every linen item with its price."),
  ("svc_add", [S(1047, 224, 1148, 253), S(312, 284, 1299, 490)], "Add a service", "Admins and Leads can add a service. Press Add service, type a name, pick a category, set the price, and save."),
  ("svc_search", [S(1256, 335, 1303, 365)], "Edit", "Press Edit on any row to change the name, price, or category, or to archive a service you no longer use."),
  ("svc_list", [S(1157, 224, 1316, 253)], "Import", "The first time, an admin presses Import from HoneyBook to load the list. Running it again only adds what is missing. Stay focused!"),
 ],
 # Nov 8 refresh: Services categories, Vydent AV estimates, HoneyBook contracts and sections. Shots are 1348x896 (est_*, svc_*, inv_*, hb_*).
 "services_v2": [
  ("svc_list", [(285, 200, 1042, 248)], "Services Catalog", "The Services Catalog is your saved list of services and prices, ready to drop into invoices and proposals. You will find it under Tools."),
  ("svc_list", [(285, 262, 826, 296)], "Search", "Type in the search box to find one fast, or pick a category to narrow the list."),
  ("svc_add", [(285, 262, 1302, 296), (301, 352, 1286, 530)], "Add a service", "Admins and Leads can add a service. Press Add service, type a name, pick a category, set the price, and save."),
  ("svc_add", [(301, 456, 503, 490)], "New category", "Need a category that is not there? Choose New category at the bottom of the list, and type a name, like a DMC category."),
  ("svc_cats", [(285, 262, 1302, 296), (285, 308, 1302, 622)], "Categories", "Press Categories to manage them all. Add your own, rename one and its items move with it, or delete one that no item uses."),
  ("svc_list", [(1240, 375, 1290, 406), (1143, 264, 1302, 294)], "Edit and import", "Press Edit on any row to change a service or archive it. The first time, an admin presses Import from HoneyBook. Stay focused!"),
 ],
 "estimates": [
  ("est_list", [(285, 298, 920, 350)], "Estimates", "Estimates in Vydent AV are what we used to call quotes. Open one to build it, price it, and send it to your client."),
  ("est_bill", [(300, 475, 748, 572)], "How it is billed", "Choose how it is billed. Direct means we bill the client, and the surcharge shows. Venue partner adds the note about the venue's service charge and taxes."),
  ("est_sections", [(300, 445, 645, 485)], "Sections", "Build the estimate in sections. Click a section name to rename it, and use the arrows to move the whole section up or down."),
  ("est_sections", [(300, 500, 510, 540)], "Move items", "Each item has arrows to move it up or down, and a Move to section menu to send it to a different section."),
  ("est_sections", [(297, 170, 1290, 232)], "Add an item", "To add an item, search by name, narrow by type, then pick a product or service and press Add line."),
  ("est_top", [(284, 362, 650, 398)], "PDFs", "Download the estimate PDF for a branded Event Estimate. Clients see each section's total with item names and quantities, but no item prices."),
  ("est_top", [(655, 362, 935, 398)], "Share", "Share an estimate link or email it, and your client can sign right on the page. Stay focused!"),
 ],
 "honeybook_v9": [
  ("hb_overview", [(848, 228, 1302, 292)], "HoneyBook", "HoneyBook in the Vydent Hub keeps your clients, projects, and payments in one place. Along the top you will find the newest tools."),
  ("hb_proj", [(459, 195, 1127, 384)], "Project page", "Open any project, and everything for that client is on one page, from emails and contracts to invoices and floor plans."),
  ("hb_email", [(459, 250, 1126, 321)], "Email client", "In Email client, press Write an email, pick a template, check the message, and send. Each email is saved in Notes and trail."),
  ("hb_email", [(459, 346, 1126, 399)], "Contracts", "In Contracts, pick a Vydent template: services only, AV only, or both together. Press New contract, and the client details, fees, and payment schedule fill in from the invoice."),
  ("hb_email", [(480, 411, 1106, 515)], "Signing", "Edit the wording, then send it for signature. The client signs on their phone, and the signed PDF lands right here."),
  ("inv_pick", [(493, 405, 1095, 562)], "Invoices", "In Invoices, press New invoice and build it in sections. Search the Services Catalog by name or category, and each item lands in its section."),
  ("inv_sec", [(493, 219, 1095, 350), (493, 362, 1095, 492)], "Sections", "Rename a section, or move sections and items up and down. Your client sees each section's total, with item names and quantities."),
  ("inv_sec", [(493, 718, 892, 768)], "Payment plan", "Pick a payment plan, and clients pay by card from the link. Checks and cash go in with Record payment. You can also download an Event Invoice or Event Receipt PDF."),
  ("hb_archive", [(371, 298, 1214, 524), (371, 548, 1214, 842)], "Archive and backup", "Archive and backup files your old HoneyBook documents on their projects. Admins can also download spreadsheet backups."),
  ("hb_reports", [(284, 286, 1301, 389)], "Sales reports", "Sales reports show how many leads turn into booked events, your booking rate, and where your leads come from."),
  ("hb_auto", [(411, 306, 1174, 697)], "Email automations", "Email automations send a thank you, a check-in, and a proposal nudge for you. Each one starts Off, so you choose what to turn on. Stay focused!"),
 ],
 "scheduling": [
  ("sch_list", [S(359, 160, 1252, 205)], "Scheduling", "Scheduling lets clients book a call with you from a link, like Calendly. You will find it under Tools."),
  ("sch_form", [S(376, 457, 1235, 489), S(376, 640, 1235, 696)], "New booking page", "Admins and Leads press New booking page. Name it, then set the call length, the buffer between calls, and how far ahead people can book."),
  ("sch_form", [S(376, 750, 1235, 895)], "Your hours", "Type your hours for each day in twenty four hour time, like nine to five. Leave a day blank for a day off."),
  ("sch_list", [S(1103, 337, 1182, 367)], "Copy link", "Save the page, then press Copy link and send it to your client. They do not need to sign in."),
  ("sch_cal", [S(415, 182, 701, 445)], "Pick a day", "Clients pick a day from a calendar. Days that are too soon or too far ahead are grayed out."),
  ("sch_slots", [S(415, 222, 953, 340)], "Pick a time", "Then they choose an open time. Times you already have booked, plus your buffer, are never offered."),
  ("sch_slots", [S(415, 355, 957, 594)], "Confirm", "They add their name and email, and confirm. You both get an email with a calendar invite."),
  ("sch_list", [S(359, 411, 1252, 492)], "Upcoming bookings", "Upcoming bookings show on the Scheduling page, where you can cancel one if plans change. Stay focused!"),
 ],
 "checklist": [
  ("ck_top", [G(388, 180, 1124, 250)], "Event gear checklist", "Every event has a gear checklist in the Vydent Hub. Open it from the calendar card, the Event Packet, or the HoneyBook project."),
  ("ck_top", [G(388, 267, 1124, 606)], "Event details", "At the top you see the contacts, venue, and floor plans from the contract, so everything for load-in is in one place."),
  ("ck_out", [G(388, 236, 1124, 665)], "Check out", "Press Check out. Tap the box as each item leaves the warehouse, or use plus and minus for part of a quantity. Your name and the time are saved."),
  ("ck_flag", [G(401, 524, 1111, 680)], "Damaged or missing", "If something is broken or missing, press Damaged or missing, say what happened, and add a photo."),
  ("ck_back", [G(388, 478, 610, 518), G(388, 570, 1124, 665)], "Check back in", "When the gear returns, press Check back in and go through the list again. Client gear shows as returned, and rented gear as picked up."),
  ("ck_add", [G(388, 393, 1124, 497)], "Add an item", "Need something extra? Press Add, pick it from the inventory, and set the quantity and where it comes from."),
  ("ck_off", [G(388, 287, 1124, 570)], "Works offline", "No signal at the venue? Open the checklist once with signal, and it keeps working offline. Changes show as Waiting to sync, and they send themselves when the signal returns."),
  ("ck_sched", [G(388, 500, 1124, 638)], "Schedule", "Set when it leaves and when it is due back. The team gets a reminder if the checklist is not complete. Stay focused!"),
 ],
 "quickbooks": [
  ("qb", [S(447, 185, 1165, 260)], "QuickBooks sync", "QuickBooks sync sends your Hub invoices and payments to QuickBooks Online, so your books stay in one place. It is for admins only."),
  ("hb_overview", [S(1027, 245, 1119, 291)], "Where to find it", "Open it from the HoneyBook page, with the QuickBooks sync button at the top."),
  ("qb", [S(447, 273, 1165, 392)], "Connect", "The first time, press Connect QuickBooks and sign in. The Test tag means practice books, so nothing real is touched until you go live."),
  ("qb", [S(447, 409, 1165, 490)], "Waiting to sync", "Waiting to sync lists every sent invoice and new payment that QuickBooks does not have yet. Press Sync on one, or Sync all."),
  ("qb", [S(463, 346, 551, 376)], "Disconnect", "If a sync fails, the reason shows on the invoice, and you can try again. You can disconnect any time, and what is already in QuickBooks stays. Stay focused!"),
 ],
}


def wav_secs(path):
    with wave.open(path) as w:
        return w.getnframes() / float(w.getframerate())


def chunk_words(text):
    shown = text.replace("Vydent", "Vident")
    words, chunks, cur = shown.split(), [], []
    for wd in words:
        cur.append(wd)
        s = " ".join(cur)
        if (len(s) >= 52) or (wd[-1] in ".!?" and len(cur) >= 3) or (wd[-1] == "," and len(s) >= 34):
            chunks.append(s); cur = []
    if cur:
        if chunks and len(" ".join(cur)) < 14:
            chunks[-1] += " " + " ".join(cur)
        else:
            chunks.append(" ".join(cur))
    return chunks


def wrap(draw, text, font, maxw):
    lines, cur = [], ""
    for wd in text.split():
        t = (cur + " " + wd).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = wd
    lines.append(cur)
    return lines


def spaced(d, xy, text, font, fill, track, anchor="l"):
    total = sum(d.textlength(c, font=font) + track for c in text) - track
    x, y = xy
    if anchor == "r":
        x -= total
    for c in text:
        d.text((x, y), c, font=font, fill=fill, anchor="lm")
        x += d.textlength(c, font=font) + track


def base_frame(shot, rects, title, f_title):
    img = Image.new("RGB", (W, H), BG)
    s = Image.open(shot).convert("RGB").crop((0, 0, CROP_W, CROP_H))
    sc = (H - TITLE_H - CAP_H) / CROP_H
    sw, sh = int(CROP_W * sc), int(CROP_H * sc)
    s = s.resize((sw, sh), Image.LANCZOS)
    ox, oy = (W - sw) // 2, TITLE_H
    img.paste(s, (ox, oy))
    d = ImageDraw.Draw(img)
    for (x1, y1, x2, y2) in rects:
        r = (ox + x1 * sc - 8, oy + y1 * sc - 8, ox + x2 * sc + 8, oy + min(y2, CROP_H) * sc + 8)
        d.rounded_rectangle(r, radius=10, outline=BRONZE, width=6)
    d.rectangle((0, 0, W, TITLE_H), fill=BAR)
    d.line((0, TITLE_H - 1, W, TITLE_H - 1), fill=BRONZE, width=3)
    spaced(d, (60, TITLE_H // 2), "VIDENT PRODUCTIONS", f_title, BRONZE, 5)
    spaced(d, (W - 60, TITLE_H // 2), title.upper(), f_title, (240, 240, 240), 5, anchor="r")
    return img


def caption_frame(base, text, f_cap):
    img = base.copy()
    d = ImageDraw.Draw(img)
    d.rectangle((0, H - CAP_H, W, H), fill=BAR)
    d.line((0, H - CAP_H, W, H - CAP_H), fill=BRONZE, width=3)
    lines = wrap(d, text, f_cap, W - 260)[:2]
    lh = 54
    y0 = H - CAP_H + (CAP_H - lh * len(lines)) // 2 + lh // 2
    for i, ln in enumerate(lines):
        d.text((W // 2, y0 + i * lh), ln, font=f_cap, fill=(255, 255, 255), anchor="mm")
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key"); ap.add_argument("--shots", required=True)
    ap.add_argument("--wavs", required=True); ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--work", default="/tmp/clbuild/work-vident")
    a = ap.parse_args()
    scenes = SCENES[a.key]
    f_title = ImageFont.truetype(os.path.join(a.fonts, "Inter-SemiBold.otf"), 30)
    f_cap = ImageFont.truetype(os.path.join(a.fonts, "Inter-SemiBold.otf"), 44)
    work = os.path.join(a.work, a.key); os.makedirs(work, exist_ok=True)
    seg_files = []
    for i, (page, rects, title, spoken) in enumerate(scenes, 1):
        wav = os.path.join(a.wavs, f"{a.key}-{i}.wav")
        total = wav_secs(wav) + PAD_END
        base = base_frame(os.path.join(a.shots, page + ".jpg"), rects, title, f_title)
        chunks = chunk_words(spoken)
        weights = [len(c) for c in chunks]
        durs = [total * w / sum(weights) for w in weights]
        lst = os.path.join(work, f"s{i}.txt")
        with open(lst, "w") as fh:
            for j, (c, dur) in enumerate(zip(chunks, durs)):
                png = os.path.join(work, f"s{i}_{j}.png")
                caption_frame(base, c, f_cap).save(png)
                fh.write(f"file '{png}'\nduration {dur:.3f}\n")
            fh.write(f"file '{png}'\n")
        seg = os.path.join(work, f"seg{i}.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-i", wav, "-vf", "fps=30,tpad=stop_mode=clone:stop_duration=2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                        "-r", "30", "-af", "apad", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "1",
                        "-t", f"{total:.3f}", seg], check=True)
        seg_files.append(seg)
    cl = os.path.join(work, "all.txt")
    with open(cl, "w") as fh:
        for s in seg_files:
            fh.write(f"file '{s}'\n")
    os.makedirs(a.out, exist_ok=True)
    out = os.path.join(a.out, OUTNAMES[a.key])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", cl,
                    "-c", "copy", "-movflags", "+faststart", out], check=True)
    print(out, os.path.getsize(out))


if __name__ == "__main__":
    sys.exit(main())
