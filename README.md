# 🚌 InStaţie: Iași Public Transport Tracker

**InStaţie** is a **Progressive Web Application (PWA)** designed to provide real-time information and tracking for the public transport system in Iaşi, Romania. Its core purpose is to offer essential functionalities, such as viewing vehicles on a map and displaying estimated arrival times at destination stations.

The application is engineered as a PWA to ensure it is easily used on mobile, fully responsive,and installable. It boasts an excellent performance score (over 90) on Lighthouse, meeting all modern PWA requirements.

---

## ✨ Key Features

InStaţie provides a complete suite of tools for public transport users:

* **Harta (Map):** Renders an OpenStreetMap using Leaflet to show all public transport stations and the real-time location of vehicles.
* **Stații (Stations):** Displays a searchable and filterable list of all stations. Selecting a station opens a modal that shows which vehicles are approaching and their estimated arrival time
* **Notificări (Notifications):** Allows users to create a subscription for a specific station and route. The system uses **Web Push** to send an alert when a vehicle approaches the subscribed station on that route
* **Știri (News):** Shows all current news and announcements related to public transport in Iași, displayed in chronological order.
* **Export:** Provides download links to export data about stations, routes, and news in **CSV format**.

---

## 🏗️ Technical Architecture

The application is structured into three main components:

1.  **Database:** PostgreSQL with the PostGIS extension.
2.  **Server:** Built with Node.js, providing a REST API.
3.  **Web Application:** The PWA client.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Database** | PostgreSQL + PostGIS | Stores relational data efficiently and handles GIS (Geographic Information System) data for routes and locations. |
| **Server** | Node.js (with Knex.js) | Provides JSON endpoints. Handles data retrieval (scraping sctpiasi.ro and using WINK API). Guesses vehicle routes and calculates arrival times. |
| **Client Communication** | Server Sent Events (SSE) | Used to stream real-time vehicle positions and arrival times from the server to the client. |
| **Frontend** | Progressive Web App (PWA) | Uses **WebManifest** for installability and a **Service Worker** for offline functionality and handling push notifications. |
| **UI Structure** | Web Components | Divides the site into reusable, single-purpose components for a clean structure. |

### Data Model

The database schema is designed around four key tables:

* **`route`**: Stores transport routes details (`external_id`, `type`, `name`, `short_name`, `vehicle_type`) and the geometry (`geom`) of the route.
* **`station`**: Stores station details (`external_id`, `name`) and the station's geometry (`geom`).
* **`route_stations`**: A join table linking `route` and `station` tables, specifying the `sequence` number of the station on a route.
* **`news`**: Stores news articles (`title`, `date`, `body`) related to public transport.

---

## 📅 Server Automation (CronJobs)

The server relies on three scheduled tasks to maintain real-time and up-to-date data:

1.  **DB Population:** Runs daily at **03:55** and upon server startup to update routes, stations, and news data.
2.  **Vehicle Refresh:** Runs every **30 seconds** to retrieve the latest GPS positions of all vehicles.
3.  **Vehicle Reset:** Runs daily at **04:00** to reset the vehicle tracking data when circulation begins.

---

## 📸 User Guide

### Installation
When you open the application, a notification will appear asking if you wish to add it to your HomeScreen. You can also install the application by pressing a button in the URL bar.
<img width="1574" height="332" alt="image" src="https://github.com/user-attachments/assets/83f55675-ec4f-40ea-82ce-c5c69c11b950" />



### News (Știri)
The first page that appears when you open the application is the news page. This page shows all news about public transport in Iași, in chronological order. Press "read more" (citește mai mult) to read the entire news article.
<img width="1599" height="691" alt="image" src="https://github.com/user-attachments/assets/f51b6839-7f19-42cf-9abf-be0fea73747d" />
<img width="1599" height="726" alt="image" src="https://github.com/user-attachments/assets/aaa090c1-70b2-42c6-9334-6e4fbff00dc5" />



### Map (Harta)
The Map page displays a map where you can see all the stations and vehicles. When the page is accessed, it requests permission to find the user's position and displays it on the map.
<img width="1598" height="724" alt="image" src="https://github.com/user-attachments/assets/a343ac37-3350-484b-8d7a-d0f570726965" />

### Stations (Stații)
The Stations page allows you to choose a station from the list. To find a specific station, you can search in the search bar. If you press on a station, you will see which vehicles are coming towards that station and the estimated arrival time.

<img width="1597" height="723" alt="image" src="https://github.com/user-attachments/assets/b42a4a7c-bbc4-4136-bfa2-1374b94deb5f" />
<img width="1599" height="724" alt="image" src="https://github.com/user-attachments/assets/8b947b16-5f73-4a31-8a0c-8e1d905cef4b" />

### Notifications (Notificări)
If you want to receive a notification when a certain vehicle is approaching a station, you can create one here. Select the desired station and route, and press "create notification!" (crează notificare!).
<img width="1587" height="727" alt="image" src="https://github.com/user-attachments/assets/33ef1ac6-9d70-4b17-a734-1ccceda90b95" />


This is what the notification you receive looks like:

<img width="1080" height="511" alt="image" src="https://github.com/user-attachments/assets/9b5a6e8e-867b-4554-9724-f6e1115e238f" />



### Export
On this page, you can download data about stations, routes, and news in CSV format.

<img width="1599" height="728" alt="image" src="https://github.com/user-attachments/assets/fb812a6d-c264-45f0-83c9-d6657340dbea" />



