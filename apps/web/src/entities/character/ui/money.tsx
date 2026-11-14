import { splitCoins } from "../model/item";

/** Gold, silver and copper coins as the game prints them. */
export function Money({ copper }: { readonly copper: number }) {
  const coins = splitCoins(copper);
  return (
    <span className="wow-money">
      {coins.gold > 0 ? (
        <span className="wow-coin wow-coin-gold">{coins.gold}</span>
      ) : null}
      {coins.gold > 0 || coins.silver > 0 ? (
        <span className="wow-coin wow-coin-silver">{coins.silver}</span>
      ) : null}
      <span className="wow-coin wow-coin-copper">{coins.copper}</span>
    </span>
  );
}
