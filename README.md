# CCAPDEV-MP
Online Airline Ticketing System

## Installation:
npm init -y

npm install express express-handlebars mongoose dotenv

## Initialization:
npm server.js

or run the file "run.bat"

## Progress:

1. User Management 
☒ Register, login, and manage user profiles. 
☒ Users can edit their profile details. 
☐ Admin accounts can manage flights and reservations.

2. Flights 
☐ Admin can create, update, delete, and view flights. 
☐ Flights should include: flight number, origin, destination, schedule, aircraft type,
seat capacity. 

3. Reservations 
☐ Passengers can create bookings (store in MongoDB). 
☐ Modify booking details (change seat, meal, baggage). 
☐ Cancel reservations with status update. 

4. Optional Packages 
☐ Store selected meal, seat, and baggage per passenger in MongoDB. 
☐ Allow editing/removing these packages after booking. 

5. Views 
☒ Use Handlebars for rendering pages (search results, reservation details, booking 
form). 
☒ Show dynamic data from MongoDB (not static anymore). 

6. CRUD Coverage 
☐ Create: Book a flight. 
☐ Read: View flights and reservations. 
☐ Update: Modify reservations, change profile, update seat/meal/baggage. 
☐ Delete: Cancel reservations, delete user accounts, remove flights (admin only). 