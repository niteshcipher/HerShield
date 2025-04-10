import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import shadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-routing-machine";

const socket = io("http://localhost:5000");

export default function Dashboard() {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const markersRef = useRef({});
  const [myLocation, setMyLocation] = useState(null);

  // Map setup
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetina,
      iconUrl: icon,
      shadowUrl: shadow,
    });

    if (!mapRef.current._leaflet_id) {
      const map = L.map(mapRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            L.marker([latitude, longitude])
              .addTo(map)
              .bindPopup("You are here!")
              .openPopup();

            setMyLocation({ latitude, longitude });
            setMapInstance(map);
          },
          (err) => {
            console.error("Geolocation error:", err);
            alert("Location permission is required!");
            map.setView([0, 0], 2);
            setMapInstance(map);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      } else {
        alert("Geolocation not supported.");
        map.setView([0, 0], 2);
        setMapInstance(map);
      }
    }
  }, []);

  // Socket events
  useEffect(() => {
    if (!mapInstance) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMyLocation({ latitude, longitude });
        socket.emit("send-location", { latitude, longitude });
      },
      (err) => console.error("Watch error:", err),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    socket.on("receive-location", ({ id, latitude, longitude }) => {
      if (!markersRef.current[id]) {
        const marker = L.marker([latitude, longitude]).addTo(mapInstance);
        markersRef.current[id] = marker;
      } else {
        markersRef.current[id].setLatLng([latitude, longitude]);
      }
    });

    socket.on("user-disconnected", (id) => {
      if (markersRef.current[id]) {
        mapInstance.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    socket.on("incoming-sos", ({ from, latitude, longitude }) => {
      if (myLocation?.latitude === latitude && myLocation?.longitude === longitude) return;

      const confirmHelp = window.confirm(
        `🚨 Someone nearby needs help at (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Will you help?`
      );

      if (confirmHelp) {
        alert("You chose to help. Routing to the location...");
      
        L.Routing.control({
          waypoints: [
            L.latLng(myLocation.latitude, myLocation.longitude),
            L.latLng(latitude, longitude),
          ],
          routeWhileDragging: false,
        }).addTo(mapInstance);
      }
      
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off("receive-location");
      socket.off("user-disconnected");
      socket.off("incoming-sos");
    };
  }, [mapInstance, myLocation]);

  const sendSOS = () => {
    if (myLocation) {
      socket.emit("sos-alert", {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
      });
      alert("🚨 SOS sent to nearby users!");
    }
  };

  return (
    <div className="h-screen w-full flex flex-col">
      <header className="bg-gradient-to-r from-red-600 to-pink-700 text-white text-center py-4 shadow-md">
        <h1 className="text-2xl font-bold">Real-Time Device Tracking</h1>
        <p className="text-sm opacity-90">All registered users live on map</p>
      </header>

      <div className="relative flex-grow">
        <div ref={mapRef} id="map" className="w-full h-full z-0"></div>

        <button
          onClick={sendSOS}
          className="absolute bottom-5 right-5 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-full shadow-lg z-10 animate-pulse"
        >
          🚨 SOS
        </button>
      </div>
    </div>
  );
}
