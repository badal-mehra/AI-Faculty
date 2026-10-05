"use client";

// STARTER TOPICS — the empty board's call to action.
//
// Before a lesson the board is a large empty rectangle, and an empty rectangle reads as "this is not
// finished" rather than "tell me what you want to learn". Filling it with decoration would make it
// worse, so it is filled with the two things a student actually needs at that moment: what this can
// teach, and a one-click way to start. Each topic is chosen because it exercises a DIFFERENT part of
// the system — a data structure, a protocol, a process, a physical quantity, a mathematical method —
// so the row doubles as an honest map of the product rather than five variations on one demo.

import { useCallback } from "react";

export type StarterTopic = {
  id: string;
  title: string;
  /** What the board will actually be asked to draw, so the choice is legible before committing. */
  detail: string;
  question: string;
};

/**
 * Chosen for coverage, not variety of wording. Between them these reach the 2D board (binary search,
 * stoichiometry, Ohm's law), the protocol layer (TCP), the 3D stage (photosynthesis) and a
 * word-problem-flavoured physics prompt (projectile), which is the widest honest sample available.
 */
export const STARTER_TOPICS: StarterTopic[] = [
  {
    id: "bst",
    title: "Binary search trees",
    detail: "Search, insert, and the deletion cases",
    question: "Draw a binary search tree and show how to search for a value in it",
  },
  {
    id: "photosynthesis",
    title: "Photosynthesis",
    detail: "Inside a chloroplast, step by step",
    question: "Explain photosynthesis and where each stage happens in the chloroplast",
  },
  {
    id: "tcp",
    title: "The TCP handshake",
    detail: "SYN, SYN-ACK, ACK, then packets",
    question: "Show me exactly what happens during a TCP handshake between a client and a server",
  },
  {
    id: "projectile",
    title: "Projectile motion",
    detail: "Forces, velocity, and the trajectory",
    question: "Explain projectile motion with the forces acting on the ball and its trajectory",
  },
  {
    id: "stoichiometry",
    title: "Stoichiometry",
    detail: "Balancing a reaction, then moles",
    question: "Work through balancing the equation for the reaction of iron with oxygen",
  },
  {
    id: "recursion",
    title: "Recursion",
    detail: "The call stack, and what unwinds it",
    question: "Explain recursion by showing the call stack for factorial of 5",
  },
];

type Props = {
  onPick: (question: string) => void;
};

export function StarterTopics({ onPick }: Props) {
  const pick = useCallback((topic: StarterTopic) => onPick(topic.question), [onPick]);
  return (
    <div className="starter-topics">
      <p className="starter-heading">Or start with one of these</p>
      <ul className="starter-grid">
        {STARTER_TOPICS.map((topic) => (
          <li key={topic.id}>
            <button type="button" className="starter-topic" onClick={() => pick(topic)}>
              <span className="starter-topic-title">{topic.title}</span>
              <span className="starter-topic-detail">{topic.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}