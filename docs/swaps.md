# Swaps state machine

Statuses: `requested`, `accepted`, `declined`, `fulfilled`, `cancelled`, `expired`.

| From        | Action    | Actor        | To          |
|-------------|-----------|--------------|-------------|
| requested   | accept    | responder    | accepted    |
| requested   | decline   | responder    | declined    |
| requested   | cancel    | requester    | cancelled   |
| requested   | expire    | system       | expired     |
| accepted    | fulfill   | requester or responder | fulfilled |

No other transitions are allowed. Permissions are enforced in `lib/swaps/state.ts` and routes under `app/api/swaps/[id]/*`.
