import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

function mskParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
  return { dateStr, timeStr };
}

function makeEvent(base, minutesAhead, data) {
  const start = new Date(base.getTime() + minutesAhead * 60 * 1000);
  const { dateStr, timeStr } = mskParts(start);
  return {
    eventId: data.eventId,
    round: data.round,
    tournament: data.tournament,
    date: dateStr,
    mskTime: timeStr,
    team1: data.team1,
    team2: data.team2,
    odds: {
      win1: data.odds.win1,
      draw: data.odds.draw,
      win2: data.odds.win2,
    },
  };
}

app.get("/events", (_req, res) => {
  const now = new Date();
  const events = [
    makeEvent(now, 30, {
      eventId: 1001,
      round: 18,
      tournament: "РПЛ",
      team1: "Спартак",
      team2: "ЦСКА",
      odds: { win1: 1.85, draw: 3.5, win2: 4.1 },
    }),
    makeEvent(now, 90, {
      eventId: 1002,
      round: 18,
      tournament: "РПЛ",
      team1: "Зенит",
      team2: "Динамо",
      odds: { win1: 2.1, draw: 3.3, win2: 3.3 },
    }),
    makeEvent(now, 150, {
      eventId: 1003,
      round: 18,
      tournament: "РПЛ",
      team1: "Локомотив",
      team2: "Краснодар",
      odds: { win1: 2.4, draw: 3.2, win2: 2.9 },
    }),
  ];
  res.json({ events });
});

const PORT = parseInt(process.env.PORT || "5050", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[events-mock] listening on http://0.0.0.0:${PORT}`);
});
