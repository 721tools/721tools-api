import { NFTTrades } from '../dal/db';

const main = async () => {
  const { rows, count } = await NFTTrades.findAndCountAll({
    limit: 100,
  });

  console.log(rows);
  console.log(count);
}

main();
