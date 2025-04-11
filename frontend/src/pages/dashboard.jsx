import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import shadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet-routing-machine";
import axios from "axios";

// Create socket connection outside the component to avoid reconnections on re-renders
const socket = io("http://localhost:5000");

export default function Dashboard() {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const markersRef = useRef({});
  const [myLocation, setMyLocation] = useState(null);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatMessagesRef = useRef(null);

  // Jitsi state
  const [jitsiLink, setJitsiLink] = useState('');
  const [showJitsiModal, setShowJitsiModal] = useState(false);
  const [incomingCalls, setIncomingCalls] = useState([]);

  // Debugging - log when jitsiLink changes
  useEffect(() => {
    if (jitsiLink) {
      console.log("Jitsi link updated:", jitsiLink);
    }
  }, [jitsiLink]);

  // Map setup
  useEffect(() => {
    if (mapRef.current && !mapRef.current._leaflet_id) {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: iconRetina,
        iconUrl: icon,
        shadowUrl: shadow,
      });

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

    // Fixed incoming SOS handler
    socket.on("incoming-sos", (data) => {
      console.log("Received incoming SOS:", data);
      const { from, latitude, longitude, jitsiLink } = data;
      
      // Skip if the SOS is from myself
      if (myLocation && 
          myLocation.latitude === latitude && 
          myLocation.longitude === longitude) {
        console.log("Ignoring SOS from myself");
        return;
      }

      // Add to incoming calls
      setIncomingCalls(prev => [...prev, { from, latitude, longitude, jitsiLink }]);

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

        // Log the received link
        console.log("Opening Jitsi link:", jitsiLink);
        
        // If there's a Jitsi link, show the modal
        if (jitsiLink) {
          setJitsiLink(jitsiLink);
          setShowJitsiModal(true);
        } else {
          console.error("No Jitsi link received with SOS");
        }
      }
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off("receive-location");
      socket.off("user-disconnected");
      socket.off("incoming-sos");
    };
  }, [mapInstance, myLocation]);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const sendSOS = () => {
    if (myLocation) {
      // Generate a unique Jitsi Meet link
      const roomId = 'sos-' + Math.random().toString(36).substring(2, 15);
      const meetLink = `https://meet.jit.si/${roomId}`;
    

      setJitsiLink(meetLink);

      // Emit SOS alert with the Jitsi link
      socket.emit("sos-alert", {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        jitsiLink: meetLink,
      });

      setShowJitsiModal(true);
      alert("🚨 SOS sent to nearby users with video call option!");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Add user message to chat
    setMessages(prevMessages => [...prevMessages, { text: userMessage, sender: 'user' }]);

    try {
      // Call your backend API
      const response = await axios.post('/api/gemini/chat', { message: userMessage });
      
      // Add Gemini's response to chat
      setMessages(prevMessages => [...prevMessages, { text: response.data.response, sender: 'gemini' }]);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      setMessages(prevMessages => [...prevMessages, { 
        text: 'Sorry, I encountered an error processing your request.', 
        sender: 'gemini' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => setShowChat(!showChat);

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

        {/* Chat button */}
        <button
          onClick={toggleChat}
          className="absolute bottom-5 left-5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-full shadow-lg z-10"
        >
          {showChat ? '✕' : '💬'}
        </button>

        {/* Chat interface */}
        {showChat && (
          <div className="absolute bottom-20 left-5 w-80 h-96 bg-white rounded-lg shadow-lg z-20 flex flex-col overflow-hidden">
            <div className="bg-blue-600 text-white p-3 font-semibold">
              Gemini Assistant
            </div>
            
            <div 
              ref={chatMessagesRef}
              className="flex-grow p-3 overflow-y-auto"
              style={{ backgroundColor: "#f8f9fa" }}
            >
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-4">
                  Ask Gemini about locations, directions, or anything else!
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`mb-2 p-2 rounded-lg max-w-[80%] ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white ml-auto'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {message.text}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="bg-gray-200 text-gray-800 p-2 rounded-lg max-w-[80%] mb-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={sendMessage} className="flex p-2 border-t">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-r-lg disabled:bg-blue-300"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Jitsi Meet Modal */}
        {showJitsiModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-xl max-w-md w-full">
              <h2 className="text-xl font-bold mb-2">Emergency Video Call</h2>
              <p className="mb-3">Use this link to communicate via video:</p>
              <div className="bg-gray-100 p-2 rounded mb-3 break-all">
                <p className="text-blue-600 text-sm">{jitsiLink}</p>
              </div>
              <div className="flex space-x-2 flex-wrap gap-2">
                <button
                  onClick={() => window.open(jitsiLink, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex-grow"
                >
                  Join Video Call
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jitsiLink);
                    alert('Video call link copied to clipboard!');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => setShowJitsiModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incoming Calls Panel */}
        {incomingCalls.length > 0 && (
          <div className="absolute top-5 right-5 bg-white p-3 rounded-lg shadow-lg z-20 max-w-xs">
            <h3 className="font-bold text-red-600 mb-2">Recent SOS Calls</h3>
            <ul className="space-y-2">
              {incomingCalls.map((call, index) => (
                <li key={index} className="border-b pb-2">
                  <p className="text-sm">SOS from location: ({call.latitude.toFixed(4)}, {call.longitude.toFixed(4)})</p>
                  {call.jitsiLink && (
                    <button 
                      onClick={() => {
                        setJitsiLink(call.jitsiLink);
                        setShowJitsiModal(true);
                      }}
                      className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                    >
                      Join Video Call
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setIncomingCalls([])}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}