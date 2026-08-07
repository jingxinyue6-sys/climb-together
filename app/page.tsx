"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Screen = "home" | "teams" | "boulder" | "duel";
type TeamKey = "mint" | "sky";
type Team = { mint: string[]; sky: string[] };
type TeamNames = { mint: string; sky: string };
type ScoreLog = {
  id: string;
  team: TeamKey;
  points: number;
  label: string;
  time: string;
};
type DuelLog = {
  id: string;
  mintPlayer: string;
  skyPlayer: string;
  mintTime: number | null;
  skyTime: number | null;
  winner: TeamKey | null;
};

const SAMPLE_NAMES = ["小林", "阿布", "Mia", "大熊", "乐乐", "Alex", "可可", "小雨"];
const STORAGE_KEY = "climb-together-v1";

function makeId() {
  const values = new Uint32Array(4);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

function secureRandom(max: number) {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do window.crypto.getRandomValues(values);
  while (values[0] >= limit);
  return values[0] % max;
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = secureRandom(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function splitNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，、;；]+/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <button className="brand" onClick={onHome} aria-label="返回首页">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>一起攀</span>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="back-button" onClick={onClick}>
      <span aria-hidden="true">←</span> 返回
    </button>
  );
}

function TeamPill({ team, label }: { team: TeamKey; label: string }) {
  return (
    <span className={`team-pill ${team}`}>{label}</span>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [names, setNames] = useState<string[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [teams, setTeams] = useState<Team>({ mint: [], sky: [] });
  const [teamNames, setTeamNames] = useState<TeamNames>({
    mint: "薄荷队",
    sky: "天空队",
  });
  const [loaded, setLoaded] = useState(false);

  const [boulderMinutes, setBoulderMinutes] = useState(20);
  const [boulderSeconds, setBoulderSeconds] = useState(20 * 60);
  const [boulderRunning, setBoulderRunning] = useState(false);
  const [boulderLogs, setBoulderLogs] = useState<ScoreLog[]>([]);
  const [boulderFinished, setBoulderFinished] = useState(false);

  const [duelScores, setDuelScores] = useState({ mint: 0, sky: 0 });
  const [duelLogs, setDuelLogs] = useState<DuelLog[]>([]);
  const [mintPlayer, setMintPlayer] = useState("");
  const [skyPlayer, setSkyPlayer] = useState("");
  const [roundRunning, setRoundRunning] = useState(false);
  const [roundElapsed, setRoundElapsed] = useState(0);
  const [finishTimes, setFinishTimes] = useState<{
    mint: number | null;
    sky: number | null;
  }>({ mint: null, sky: null });
  const boulderEndRef = useRef<number | null>(null);
  const roundStartRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(saved.names)) {
        setNames(saved.names);
        setNameDraft(saved.names.join("\n"));
      }
      if (saved.teams?.mint && saved.teams?.sky) setTeams(saved.teams);
      if (saved.teamNames?.mint && saved.teamNames?.sky) setTeamNames(saved.teamNames);
      if (Number.isFinite(saved.boulderMinutes)) {
        const minutes = Math.min(180, Math.max(1, Number(saved.boulderMinutes)));
        setBoulderMinutes(minutes);
        setBoulderSeconds(minutes * 60);
      }
    } catch {
      // Ignore malformed local data and start fresh.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ names, teams, teamNames, boulderMinutes }),
      );
    } catch {
      // Some browsers can restrict storage for local files; the game still works for this session.
    }
  }, [names, teams, teamNames, boulderMinutes, loaded]);

  useEffect(() => {
    if (!boulderRunning) return;
    boulderEndRef.current = Date.now() + boulderSeconds * 1000;
    const timer = window.setInterval(() => {
      if (!boulderEndRef.current) return;
      const remaining = Math.max(
        0,
        Math.ceil((boulderEndRef.current - Date.now()) / 1000),
      );
      setBoulderSeconds(remaining);
      if (remaining === 0) {
        setBoulderRunning(false);
        setBoulderFinished(true);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [boulderRunning]);

  useEffect(() => {
    if (!roundRunning) return;
    roundStartRef.current = Date.now() - roundElapsed * 1000;
    const timer = window.setInterval(() => {
      if (roundStartRef.current) {
        setRoundElapsed((Date.now() - roundStartRef.current) / 1000);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [roundRunning]);

  useEffect(() => {
    if (!mintPlayer && teams.mint.length) setMintPlayer(teams.mint[0]);
    if (!skyPlayer && teams.sky.length) setSkyPlayer(teams.sky[0]);
  }, [teams, mintPlayer, skyPlayer]);

  const boulderScore = useMemo(
    () =>
      boulderLogs.reduce(
        (score, item) => ({ ...score, [item.team]: score[item.team] + item.points }),
        { mint: 0, sky: 0 },
      ),
    [boulderLogs],
  );

  const hasTeams = teams.mint.length + teams.sky.length >= 2;

  function saveNames() {
    const parsed = splitNames(nameDraft);
    setNames(parsed);
    if (
      teams.mint.some((name) => !parsed.includes(name)) ||
      teams.sky.some((name) => !parsed.includes(name))
    ) {
      setTeams({ mint: [], sky: [] });
    }
  }

  function randomizeTeams(nextScreen: Screen = "teams") {
    const roster = splitNames(nameDraft);
    if (roster.length < 2) return;
    setNames(roster);
    const mixed = shuffle(roster);
    const next = {
      mint: mixed.filter((_, index) => index % 2 === 0),
      sky: mixed.filter((_, index) => index % 2 === 1),
    };
    setTeams(next);
    setMintPlayer(next.mint[0] || "");
    setSkyPlayer(next.sky[0] || "");
    setScreen(nextScreen);
  }

  function enterGame(game: "boulder" | "duel") {
    if (!hasTeams) {
      setScreen("teams");
      return;
    }
    setScreen(game);
  }

  function addBoulderScore(team: TeamKey, points: number, label: string) {
    setBoulderLogs((logs) => [
      {
        id: makeId(),
        team,
        points,
        label,
        time: nowLabel(),
      },
      ...logs,
    ]);
  }

  function resetBoulder() {
    setBoulderRunning(false);
    setBoulderSeconds(boulderMinutes * 60);
    setBoulderLogs([]);
    setBoulderFinished(false);
  }

  function updateBoulderMinutes(value: number) {
    const minutes = Math.min(180, Math.max(1, Math.round(value || 1)));
    setBoulderMinutes(minutes);
    setBoulderSeconds(minutes * 60);
    setBoulderFinished(false);
  }

  function startRound() {
    if (!mintPlayer || !skyPlayer) return;
    setRoundElapsed(0);
    setFinishTimes({ mint: null, sky: null });
    setRoundRunning(true);
  }

  function captureFinish(team: TeamKey) {
    if (!roundRunning || finishTimes[team] !== null) return;
    const time = Math.max(0.1, Number(roundElapsed.toFixed(1)));
    const next = { ...finishTimes, [team]: time };
    setFinishTimes(next);
    if (next.mint !== null && next.sky !== null) completeRound(next);
  }

  function completeRound(times = finishTimes) {
    if (!mintPlayer || !skyPlayer || (!roundRunning && !times.mint && !times.sky)) return;
    let winner: TeamKey | null = null;
    if (times.mint !== null && times.sky === null) winner = "mint";
    if (times.sky !== null && times.mint === null) winner = "sky";
    if (times.mint !== null && times.sky !== null) {
      if (times.mint < times.sky) winner = "mint";
      if (times.sky < times.mint) winner = "sky";
    }
    if (winner) setDuelScores((score) => ({ ...score, [winner]: score[winner] + 1 }));
    setDuelLogs((logs) => [
      {
        id: makeId(),
        mintPlayer,
        skyPlayer,
        mintTime: times.mint,
        skyTime: times.sky,
        winner,
      },
      ...logs,
    ]);
    setRoundRunning(false);
    setRoundElapsed(0);
    setFinishTimes({ mint: null, sky: null });
  }

  function undoDuel() {
    const [latest, ...rest] = duelLogs;
    if (!latest) return;
    if (latest.winner) {
      setDuelScores((score) => ({
        ...score,
        [latest.winner as TeamKey]: Math.max(0, score[latest.winner as TeamKey] - 1),
      }));
    }
    setDuelLogs(rest);
  }

  const resultText = (mint: number, sky: number) =>
    mint === sky
      ? "势均力敌，平局！"
      : mint > sky
        ? `${teamNames.mint}获胜！`
        : `${teamNames.sky}获胜！`;

  return (
    <main>
      <header className="topbar">
        <Brand onHome={() => setScreen("home")} />
        <button className="roster-shortcut" onClick={() => setScreen("teams")}>
          <span aria-hidden="true">☺</span>
          {names.length ? `${names.length} 位攀友` : "录入名单"}
        </button>
      </header>

      {screen === "home" && (
        <section className="home-screen">
          <div className="hero">
            <span className="eyebrow">CLIMB · PLAY · TOGETHER</span>
            <h1>
              今天，一起
              <br />
              <em>攀</em>点好玩的
            </h1>
            <p>适合新手的轻松小游戏。随机组队、直接开赛，输赢没那么重要，玩得尽兴才是。</p>
            <div className="hero-tags" aria-label="活动特点">
              <span>✦ 新手友好</span>
              <span>✦ 2 分钟开局</span>
              <span>✦ 手机计分</span>
            </div>
          </div>

          <section className="game-section">
            <div className="section-title">
              <div>
                <span className="step-number">01</span>
                <h2>选个游戏</h2>
              </div>
              <p>二选一，随时换</p>
            </div>
            <div className="game-grid">
              <article className="game-card boulder-card">
                <div className="card-top">
                  <span className="game-number">GAME 01</span>
                  <span className="duration">{boulderMinutes} MIN</span>
                </div>
                <div className="hold-art" aria-hidden="true">
                  <i className="hold h1" />
                  <i className="hold h2" />
                  <i className="hold h3" />
                  <i className="hold h4" />
                  <i className="route-line" />
                </div>
                <h3>抱石限时积分赛</h3>
                <p>
                  {boulderMinutes} 分钟自由刷线。V1–V4 分别得 1–4 分，累计分高的队伍获胜。
                </p>
                <button className="primary-button" onClick={() => enterGame("boulder")}>
                  开始这局 <span>→</span>
                </button>
              </article>

              <article className="game-card duel-card">
                <div className="card-top">
                  <span className="game-number">GAME 02</span>
                  <span className="duration">1 VS 1</span>
                </div>
                <div className="duel-art" aria-hidden="true">
                  <div className="climber climber-a">●<i /><b /></div>
                  <span>VS</span>
                  <div className="climber climber-b">●<i /><b /></div>
                </div>
                <h3>难度比拼</h3>
                <p>两队轮流派人 1v1。完攀得分；都完攀时，用时更短的一队得分。</p>
                <button className="primary-button dark" onClick={() => enterGame("duel")}>
                  开始这局 <span>→</span>
                </button>
              </article>
            </div>
          </section>

          <section className="team-cta">
            <div>
              <span className="step-number light">02</span>
              <h2>{hasTeams ? "队伍已经就位" : "先把大家分成两队"}</h2>
              <p>
                {hasTeams
                  ? `${teamNames.mint} ${teams.mint.length} 人 · ${teamNames.sky} ${teams.sky.length} 人，名单已保存在这台设备。`
                  : "输入名单，一键随机且平均分组。下一个游戏也能继续用。"}
              </p>
            </div>
            <button onClick={() => setScreen("teams")}>
              {hasTeams ? "查看 / 重分" : "去随机分组"} <span>↗</span>
            </button>
          </section>
        </section>
      )}

      {screen === "teams" && (
        <section className="inner-screen">
          <BackButton onClick={() => setScreen("home")} />
          <div className="page-heading">
            <span className="eyebrow">FAIR &amp; RANDOM</span>
            <h1>随机分组</h1>
            <p>每行一个名字，也可以用逗号隔开。名单会自动保存在这台设备。</p>
          </div>

          <div className="roster-layout">
            <div className="panel roster-panel">
              <div className="panel-heading">
                <h2>参与名单</h2>
                <span>{splitNames(nameDraft).length} 人</span>
              </div>
              <textarea
                aria-label="参与人员名单"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={saveNames}
                placeholder={"小林\n阿布\nMia\n大熊"}
              />
              <div className="team-name-editor">
                <label>
                  <span>队伍 A 名称</span>
                  <input
                    aria-label="队伍 A 名称"
                    maxLength={12}
                    value={teamNames.mint}
                    onChange={(event) =>
                      setTeamNames((current) => ({
                        ...current,
                        mint: event.target.value || "队伍 A",
                      }))
                    }
                  />
                </label>
                <label>
                  <span>队伍 B 名称</span>
                  <input
                    aria-label="队伍 B 名称"
                    maxLength={12}
                    value={teamNames.sky}
                    onChange={(event) =>
                      setTeamNames((current) => ({
                        ...current,
                        sky: event.target.value || "队伍 B",
                      }))
                    }
                  />
                </label>
              </div>
              <div className="roster-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    setNameDraft(SAMPLE_NAMES.join("\n"));
                    setNames(SAMPLE_NAMES);
                  }}
                >
                  填入示例
                </button>
                <button
                  className="shuffle-button"
                  disabled={splitNames(nameDraft).length < 2}
                  onClick={() => randomizeTeams()}
                >
                  <span aria-hidden="true">⤨</span> 真随机分组
                </button>
              </div>
              <p className="random-note">使用设备加密随机数打乱，每次结果都不可预测。</p>
            </div>

            <div className="team-results">
              {!hasTeams ? (
                <div className="empty-teams">
                  <div className="empty-icon" aria-hidden="true">⤨</div>
                  <h3>等待分组</h3>
                  <p>至少输入 2 个名字，然后点击“真随机分组”。</p>
                </div>
              ) : (
                <>
                  <div className="team-card mint">
                    <div className="team-card-heading">
                      <TeamPill team="mint" label={teamNames.mint} />
                      <span>{teams.mint.length} 人</span>
                    </div>
                    <div className="member-list">
                      {teams.mint.map((name, index) => (
                        <span key={`${name}-${index}`}>
                          <b>{String(index + 1).padStart(2, "0")}</b> {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="team-card sky">
                    <div className="team-card-heading">
                      <TeamPill team="sky" label={teamNames.sky} />
                      <span>{teams.sky.length} 人</span>
                    </div>
                    <div className="member-list">
                      {teams.sky.map((name, index) => (
                        <span key={`${name}-${index}`}>
                          <b>{String(index + 1).padStart(2, "0")}</b> {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="reshuffle" onClick={() => randomizeTeams()}>
                    ↻ 不满意？重新随机
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {screen === "boulder" && (
        <section className="inner-screen game-live">
          <BackButton onClick={() => setScreen("home")} />
          <div className="live-title">
            <div>
              <span className="eyebrow">GAME 01</span>
              <h1>抱石限时积分赛</h1>
            </div>
            <span className="rules-chip">V1–V4 · 1–4 分</span>
          </div>

          <div className={`timer ${boulderSeconds <= 60 ? "urgent" : ""}`}>
            <div className="duration-settings">
              <span>本局时长</span>
              <div className="duration-presets">
                {[10, 15, 20, 30].map((minutes) => (
                  <button
                    key={minutes}
                    className={boulderMinutes === minutes ? "active" : ""}
                    disabled={boulderRunning}
                    onClick={() => updateBoulderMinutes(minutes)}
                  >
                    {minutes} 分
                  </button>
                ))}
              </div>
              <label>
                <input
                  aria-label="自定义比赛时长，分钟"
                  type="number"
                  min="1"
                  max="180"
                  disabled={boulderRunning}
                  value={boulderMinutes}
                  onChange={(event) => updateBoulderMinutes(Number(event.target.value))}
                />
                分钟
              </label>
            </div>
            <span>剩余时间</span>
            <strong>{formatClock(boulderSeconds)}</strong>
            <div className="timer-actions">
              <button
                className="timer-main"
                disabled={boulderSeconds === 0}
                onClick={() => setBoulderRunning((value) => !value)}
              >
                {boulderRunning
                  ? "暂停"
                  : boulderSeconds === boulderMinutes * 60
                    ? "开始计时"
                    : "继续"}
              </button>
              <button onClick={resetBoulder}>重置</button>
            </div>
          </div>

          <div className="score-grid">
            {(["mint", "sky"] as TeamKey[]).map((team) => (
              <div className={`score-card ${team}`} key={team}>
                <TeamPill team={team} label={teamNames[team]} />
                <strong>{boulderScore[team]}</strong>
                <span className="score-unit">分</span>
                <div className="score-buttons">
                  {[1, 2, 3, 4].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        addBoulderScore(team, level, `V${level} 完攀`)
                      }
                    >
                      <small>V{level} 完攀</small>
                      <b>+{level}</b>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {(boulderFinished || boulderLogs.length > 0) && (
            <div className="activity-panel">
              <div className="panel-heading">
                <h2>{boulderFinished ? resultText(boulderScore.mint, boulderScore.sky) : "实时记录"}</h2>
                {boulderLogs.length > 0 && (
                  <button onClick={() => setBoulderLogs((logs) => logs.slice(1))}>撤销上一步</button>
                )}
              </div>
              <div className="log-list">
                {boulderLogs.slice(0, 6).map((log) => (
                  <div className="log-row" key={log.id}>
                    <TeamPill team={log.team} label={teamNames[log.team]} />
                    <span>{log.label}</span>
                    <b>+{log.points}</b>
                    <time>{log.time}</time>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {screen === "duel" && (
        <section className="inner-screen game-live">
          <BackButton onClick={() => setScreen("home")} />
          <div className="live-title">
            <div>
              <span className="eyebrow">GAME 02</span>
              <h1>难度比拼</h1>
            </div>
            <span className="rules-chip">完攀 +1 · 同完攀比用时</span>
          </div>

          <div className="duel-scoreboard">
            <div className="duel-team mint">
              <TeamPill team="mint" label={teamNames.mint} />
              <strong>{duelScores.mint}</strong>
            </div>
            <div className="duel-round-clock">
              <span>本轮计时</span>
              <b>{roundElapsed.toFixed(1)}s</b>
              <small>ROUND {String(duelLogs.length + 1).padStart(2, "0")}</small>
            </div>
            <div className="duel-team sky">
              <TeamPill team="sky" label={teamNames.sky} />
              <strong>{duelScores.sky}</strong>
            </div>
          </div>

          <div className="matchup-panel">
            <div className="player-select mint">
              <label htmlFor="mint-player">{teamNames.mint}出战</label>
              <select
                id="mint-player"
                value={mintPlayer}
                disabled={roundRunning}
                onChange={(event) => setMintPlayer(event.target.value)}
              >
                {teams.mint.map((name) => <option key={name}>{name}</option>)}
              </select>
              <button
                disabled={!roundRunning || finishTimes.mint !== null}
                onClick={() => captureFinish("mint")}
              >
                {finishTimes.mint === null ? "✓ 完攀" : `${finishTimes.mint.toFixed(1)}s`}
              </button>
            </div>
            <span className="versus">VS</span>
            <div className="player-select sky">
              <label htmlFor="sky-player">{teamNames.sky}出战</label>
              <select
                id="sky-player"
                value={skyPlayer}
                disabled={roundRunning}
                onChange={(event) => setSkyPlayer(event.target.value)}
              >
                {teams.sky.map((name) => <option key={name}>{name}</option>)}
              </select>
              <button
                disabled={!roundRunning || finishTimes.sky !== null}
                onClick={() => captureFinish("sky")}
              >
                {finishTimes.sky === null ? "✓ 完攀" : `${finishTimes.sky.toFixed(1)}s`}
              </button>
            </div>
          </div>

          <div className="round-actions">
            {!roundRunning ? (
              <button className="round-start" onClick={startRound}>开始本轮</button>
            ) : (
              <button className="round-end" onClick={() => completeRound()}>
                结束本轮并结算
              </button>
            )}
            <p>若只有一人完攀，点“结束本轮”即可为其队伍加 1 分。</p>
          </div>

          {duelLogs.length > 0 && (
            <div className="activity-panel">
              <div className="panel-heading">
                <h2>回合记录</h2>
                <button onClick={undoDuel}>撤销上一轮</button>
              </div>
              <div className="log-list duel-logs">
                {duelLogs.slice(0, 6).map((log, index) => (
                  <div className="log-row" key={log.id}>
                    <span className="round-index">R{duelLogs.length - index}</span>
                    <span>{log.mintPlayer} {log.mintTime ? `${log.mintTime.toFixed(1)}s` : "未完攀"}</span>
                    <b>
                      {log.winner ? (
                        <TeamPill
                          team={log.winner}
                          label={teamNames[log.winner]}
                        />
                      ) : "平局"}
                    </b>
                    <span>{log.skyPlayer} {log.skyTime ? `${log.skyTime.toFixed(1)}s` : "未完攀"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <footer>
        <span>一起攀 · 为线下攀岩活动而做</span>
        <span>玩得开心，注意安全</span>
      </footer>
    </main>
  );
}
