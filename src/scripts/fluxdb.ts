import { NFTSales } from '../dal/db';

const main =async () => {
    const { rows, count } = await NFTSales.findAndCountAll({
        limit: 100,
      });

    console.log(rows);
    console.log(count);
}

main();
