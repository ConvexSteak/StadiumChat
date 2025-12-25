import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// =====================
// SUPABASE CONFIG
// =====================
const supabaseUrl = "https://jpftbgglvgrlmnpudxjr.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZnRiZ2dsdmdybG1ucHVkeGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTczNTAsImV4cCI6MjA4MTczMzM1MH0.cHL9154nP-WFpT6K3rXsIwmI5JhCD-JC1ClPdXILOrM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// STABLE CHAT IDS (🔥 FIX)
const GAME_IDS = {
  NFL: "chat-nfl",
  NBA: "chat-nba",
  NHL: "chat-nhl",
};

// =====================
// SCOREBOARD
// =====================
function Scoreboard({ sport }) {
  const [games, setGames] = useState([]);

  useEffect(() => {
    const fetchScores = async () => {
      let url;
      if (sport === "NFL")
        url =
          "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
      else if (sport === "NBA")
        url =
          "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
      else if (sport === "NHL")
        url =
          "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard";
      else return;

      try {
        const res = await fetch(url);
        const data = await res.json();

        const mapped = (data.events || []).map((e) => {
          const c = e.competitions[0].competitors;
          return {
            id: e.id,
            away: c[1].team.abbreviation,
            home: c[0].team.abbreviation,
            awayScore: c[1].score,
            homeScore: c[0].score,
            status: e.status.type.shortDetail,
          };
        });

        setGames(mapped);
      } catch (err) {
        console.error(err);
      }
    };

    fetchScores();
  }, [sport]);

  return (
    <div
      style={{
        padding: 10,
        background: "#001E33",
        color: "white",
        display: "flex",
        gap: 10,
        overflowX: "auto",
      }}
    >
      {games.length === 0
        ? "Updating Live Scores..."
        : games.map((g) => (
            <div
              key={g.id}
              style={{
                minWidth: 135,
                background: "#002a4d",
                padding: 8,
                borderRadius: 8,
                fontSize: 11,
              }}
            >
              <strong>
                {g.away} {g.awayScore} @ {g.home} {g.homeScore}
              </strong>
              <div style={{ fontSize: 9, color: "#9ecaff" }}>{g.status}</div>
            </div>
          ))}
    </div>
  );
}

// =====================
// MAIN APP
// =====================
export default function App() {
  const [activeTab, setActiveTab] = useState("NFL");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(localStorage.getItem("chat_username"));
  const [tempName, setTempName] = useState("");
  const messagesEndRef = useRef(null);

  const chatRoomId = GAME_IDS[activeTab];

  // =====================
  // CHAT (WORKING PATTERN)
  // =====================
  useEffect(() => {
    if (!user) return;

    setMessages([]);

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("game_comments")
        .select("*")
        .eq("game_id", chatRoomId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    };

    fetchMsgs();

    const channel = supabase
      .channel(`chat-${chatRoomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_comments" },
        (payload) => {
          if (payload.new.game_id === chatRoomId) {
            setMessages((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, chatRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await supabase.from("game_comments").insert([
      {
        game_id: chatRoomId,
        content: newMessage,
        user_name: user,
      },
    ]);

    setNewMessage("");
  };

  // =====================
  // LOGIN SCREEN
  // =====================
  if (!user) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#001E33",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tempName.trim()) return;
            localStorage.setItem("chat_username", tempName);
            setUser(tempName);
          }}
          style={{
            background: "#002a4d",
            padding: 40,
            borderRadius: 12,
            color: "white",
          }}
        >
          <h2>Stadium Chat</h2>
          <input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Username..."
            style={{ padding: 12 }}
          />
          <br />
          <br />
          <button style={{ padding: "10px 20px" }}>Enter</button>
        </form>
      </div>
    );
  }

  // =====================
  // UI
  // =====================
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: 10,
          background: "#001E33",
        }}
      >
        {["NFL", "NBA", "NHL"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "8px 12px",
              background: activeTab === t ? "#2ecc71" : "#002a4d",
              color: "white",
              border: "none",
              borderRadius: 6,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <Scoreboard sport={activeTab} />

      <div style={{ flex: 1, overflowY: "auto", padding: 15 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              background: "white",
              padding: 10,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <strong>{m.user_name}</strong>
            <div>{m.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={sendMsg}
        style={{ display: "flex", padding: 10, borderTop: "1px solid #ccc" }}
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={`Chat about ${activeTab}...`}
          style={{ flex: 1, padding: 10 }}
        />
        <button style={{ padding: "0 20px" }}>Send</button>
      </form>
    </div>
  );
}
