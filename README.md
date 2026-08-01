Game Room Management System — Project Overview

What I'm Building

I'm building a website and tablet-based system to manage our mosque's community game room. Right now, we have PS5s, Nintendo Switches, a pool table, air hockey, foosball, and table tennis — and we want to make sure everything is organized, fair, and accountable. This system will handle signing members in and out, tracking who is using which equipment, and showing a live public display of what's available.

Why We Need This

Without a system, it's hard to know:

· Who is currently in the game room
· Which equipment is being used and by whom
· Whether equipment gets damaged and who had it last
· How many people are visiting and when the busiest times are
· If someone is hogging a popular item while others are waiting

This project solves all of that. It makes the game room safer, more organized, and more enjoyable for everyone.

How It Works (Simple Version)

There are two main parts:

1. The Public Screen
A monitor or TV mounted outside or inside the game room shows:

· How many people are currently inside
· Which equipment is available and which is in use (with green/yellow/red indicators)
· Opening hours, announcements, upcoming events, and community rules
· This screen is visible to everyone — no login needed

Members can also log in from their phones to see their own visit history and update their contact details.

2. The Volunteer Tablet (Kiosk)
A tablet at the entrance that volunteers use to:

· Sign members in when they arrive and out when they leave
· Quickly find a member by typing their name, phone number, or scanning their member QR card
· Register new members (takes their photo with the tablet camera, emergency contact info, etc.)
· Assign equipment to members (e.g., "Ahmed has PS5 Controller #3 and the Pool Table")
· Return equipment when they're done, with an option to note any damage
· See a live dashboard of who is inside and what's checked out

Everything goes through volunteers so we know the data is accurate.

Key Features We're Including

· QR Code Member Cards — Each member gets a scannable QR code so sign-in takes one second
· Time Limits & Waiting Queue — If someone has been on the PS5 for an hour and others are waiting, the system lets volunteers know and shows who's next in line
· Equipment Health Tracking — Every item is marked Good, Minor Issue, or Out of Order so broken gear isn't handed out
· Volunteer Shift Scheduling — Volunteers can see their shifts and follow a checklist when they start (count equipment, check for damage, confirm occupancy)
· Guest Passes — Members can bring a friend or two, tracked under their name for accountability
· Digital Waivers — Everyone signs a waiver before using the room; parents sign for minors
· Offline Mode — If the Wi-Fi drops, the tablet still works and syncs everything when it's back online
· Analytics — Admins can see which days are busiest, what equipment is most popular, and how many community hours we're serving
· Multi-Language Ready — Built so we can easily add other languages later

The Equipment We're Tracking

Item Quantity
PS5 Consoles 6
PS5 Controllers 24
Nintendo Switch Consoles 4
Nintendo Switch Controllers 8
Table Tennis 1
Foosball 1
Pool Table 1
Air Hockey 1

That's 46 individual items, all tracked separately.

Who Can Do What

· Visitors — See the public screen and announcements
· Members — See their own profile and history; cannot sign themselves in or take equipment
· Volunteers — Run the day-to-day: sign people in/out, manage equipment, register new members
· Admins — Full control: manage inventory, create volunteer accounts, see analytics and audit logs, configure settings

The Technology (For Those Interested)

It's being built as a modern web application using Next.js and PostgreSQL. The volunteer tablet will work even without internet (it's a Progressive Web App). Everything is secure, with strict permissions so no one can access features they shouldn't.

The Goal

A game room that runs smoothly, where:

· Equipment is respected and accounted for
· Everyone gets a fair turn
· Parents know their kids are in a safe, supervised environment
· The mosque leadership can see the positive impact with real numbers
· Volunteers feel supported with clear processes
