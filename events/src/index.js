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

function getMatchStatus(startTime, now) {
  const timeDiff = startTime - now;
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Если матч начинается более чем через 1 час - upcoming
  if (hoursDiff > 1) return "upcoming";
  
  // Если матч начинается в течение часа - live (включая время матча 1.5 часа)
  if (hoursDiff > -1.5) return "live";
  
  // Если матч закончился более 1.5 часов назад - finished
  return "finished";
}

function makeEvent(base, minutesAhead, data) {
  const start = new Date(base.getTime() + minutesAhead * 60 * 1000);
  const { dateStr, timeStr } = mskParts(start);
  const status = getMatchStatus(start, base);
  
  // Добавляем счет для live и finished матчей
  let score = null;
  if (status === "live" || status === "finished") {
    score = {
      team1: Math.floor(Math.random() * 4), // случайный счет 0-3
      team2: Math.floor(Math.random() * 4),
    };
  }
  
  return {
    eventId: data.eventId,
    round: data.round,
    tournament: data.tournament,
    date: dateStr,
    mskTime: timeStr,
    team1: data.team1,
    team2: data.team2,
    status: status,
    score: score,
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
    // Добавим отмененный матч и завершенный матч
    makeEvent(now, -120, {
      eventId: 1004,
      round: 17,
      tournament: "РПЛ",
      team1: "Ростов",
      team2: "Урал",
      odds: { win1: 1.9, draw: 3.4, win2: 4.0 },
    }),
    makeEvent(now, -240, {
      eventId: 1005,
      round: 17,
      tournament: "РПЛ",
      team1: "Оренбург",
      team2: "Ахмат",
      odds: { win1: 2.2, draw: 3.1, win2: 3.2 },
    }),
  ];
  
  // Добавим отмененный матч вручную
  const canceledEvent = {
    eventId: 1006,
    round: 18,
    tournament: "РПЛ",
    date: "2024-03-15",
    mskTime: "19:00:00",
    team1: "Крылья Советов",
    team2: "Факел",
    status: "canceled",
    score: null,
    odds: { win1: 2.0, draw: 3.2, win2: 3.8 },
  };
  
  events.push(canceledEvent);
  
  res.json({ events });
});

const PORT = parseInt(process.env.PORT || "5050", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[events-mock] listening on http://0.0.0.0:${PORT}`);
});