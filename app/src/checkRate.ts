import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";

// Pyth ID for exchange rate of XTZ to USD
const XTZ_USD_ID = "0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03" as string;

const DELAY = 3; // Delay in seconds between polling Hermes for price data
const CHANGE_THRESHOLD = 0.0001; // Minimum change in exchange ratethat counts as a price fluctuation

const run = async () => {
  const connection = new HermesClient("https://hermes.pyth.network");
  let baselinePrice = await getPrice(connection);
  console.log("Baseline price:", baselinePrice);

  const updatedPrice = await alertOnPriceFluctuations(baselinePrice, connection);
  console.log("Price changed:", updatedPrice);
  if (baselinePrice > updatedPrice) {
    console.log("Time to buy");
  } else if (baselinePrice < updatedPrice) {
    console.log("Time to sell");
  }
}

// Get the baseline price and poll until it changes past the threshold
const alertOnPriceFluctuations = async (_baselinePrice, connection): Promise<number> => {
  const baselinePrice = _baselinePrice;
  await delaySeconds(DELAY);
  let updatedPrice = await getPrice(connection);
  while (Math.abs(baselinePrice - updatedPrice) < CHANGE_THRESHOLD) {
    await delaySeconds(DELAY);
    updatedPrice = await getPrice(connection);
  }
  return updatedPrice;
}

const delaySeconds = seconds => new Promise(res => setTimeout(res, seconds*1000));

// Return the current price of one XTZ in USD
const getPrice = async (connection) => {
  const priceIds = [XTZ_USD_ID];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds) as PriceUpdate;
  const parsedPrice = priceFeedUpdateData.parsed![0].price;
  const actualPrice = parseInt(parsedPrice.price) * (10 ** parsedPrice.expo)
  console.log ("One XTZ is worth ", actualPrice, "USD");
  return actualPrice;
}

run();
