import type { Storyline, StorylineKind } from "./storylines.js";

export type WriterStyle = "professional" | "playful" | "roast";

const commentary: Record<WriterStyle, Record<StorylineKind, string>> = {
  professional: {
    biggest_riser: "A significant improvement in the Power Rankings.",
    biggest_fall: "A challenging week for the team's ranking.",
    weekly_overperformer: "Weekly performance exceeded its overall ranking.",
    weekly_underperformer: "Weekly performance trailed its overall ranking.",
  },

  playful: {
    biggest_riser: "The power rankings needed an express elevator.",
    biggest_fall: "Gravity apparently has a favorite fantasy team.",
    weekly_overperformer:
      "Someone forgot to tell this team where it was ranked.",
    weekly_underperformer:
      "The ranking showed up. The weekly performance took a detour.",
  },

  roast: {
    biggest_riser: "Someone finally found the button labeled 'up'.",
    biggest_fall: "That wasn't a slide down the rankings. That was a trapdoor.",
    weekly_overperformer:
      "Making the teams above them look a little uncomfortable.",
    weekly_underperformer:
      "The reputation arrived. The performance missed the invitation.",
  },
};

export function formatStoryline(
  story: Storyline,
  style: WriterStyle = "playful",
): string {
  const { team, kind, powerRank, allPlayRank, movement } = story;

  let heading: string;
  let facts: string;

  switch (kind) {
    case "biggest_riser":
      heading = `🚀 *The Climb — ${team}*`;
      facts =
        `Up ${movement} spots to #${powerRank} in the Power Rankings. ` +
        `Weekly All-Play: #${allPlayRank}.`;
      break;

    case "biggest_fall":
      heading = `📉 *The Freefall — ${team}*`;
      facts =
        `Down ${Math.abs(movement ?? 0)} spots to #${powerRank}. ` +
        `Weekly All-Play: #${allPlayRank}.`;
      break;

    case "weekly_overperformer":
      heading = `🔥 *Above Expectations — ${team}*`;
      facts =
        `Power ranked #${powerRank}, but finished #${allPlayRank} ` +
        `in weekly All-Play. That's ${powerRank - allPlayRank} ` +
        `places above their overall ranking.`;
      break;

    case "weekly_underperformer":
      heading = `🥶 *A Rough Week — ${team}*`;
      facts =
        `Power ranked #${powerRank}, but finished #${allPlayRank} ` +
        `in weekly All-Play. That's ${allPlayRank - powerRank} ` +
        `places below their overall ranking.`;
      break;
  }

  return [heading, facts, commentary[style][kind]].join("\n");
}

export interface MatchupFacts {
  firstTeam: string;
  secondTeam: string;
  firstLeads: number;
  secondLeads: number;
  ties: number;
}

export function formatMatchupCommentary(
  facts: MatchupFacts,
  style: WriterStyle = "playful",
): string {
  const { firstTeam, secondTeam, firstLeads, secondLeads, ties } = facts;

  if (firstLeads === secondLeads) {
    return (
      `${firstTeam} and ${secondTeam} are level in category leads ` +
      `(${firstLeads} each, ${ties} tied). ` +
      "Nobody gets a victory lap just yet."
    );
  }

  const leader = firstLeads > secondLeads ? firstTeam : secondTeam;

  const opponent = firstLeads > secondLeads ? secondTeam : firstTeam;

  const score =
    `${Math.max(firstLeads, secondLeads)}–` +
    `${Math.min(firstLeads, secondLeads)}`;

  switch (style) {
    case "professional":
      return (
        `${leader} currently leads ${opponent} ${score} in categories. ` +
        "These are provisional results, not a finalized matchup."
      );

    case "playful":
      return (
        `${leader} is up ${score} on the category scoreboard. ` +
        `${opponent} still has time to respond, so nobody ` +
        "should start the victory parade yet."
      );

    case "roast":
      return (
        `${leader} leads ${score}. ${opponent} has some catching up ` +
        "to do, but celebrating before the week ends is how " +
        "fantasy basketball creates its best comeback stories."
      );
  }
}
