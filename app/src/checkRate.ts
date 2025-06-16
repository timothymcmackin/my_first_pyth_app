import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";
import { createWalletClient, http, getContract, createPublicClient, defineChain, Account, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abi } from "../../contracts/out/TutorialContract.sol/TutorialContract.json";
import { etherlinkTestnet } from "viem/chains";

// Pyth ID for exchange rate of XTZ to USD
const XTZ_USD_ID = "0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03" as string;

// Contract I deployed
// const CONTRACT_ADDRESS = "0xB935c07C2eC4FA74f2DA39A561E88A9613BE9668" as any; // testnet
const CONTRACT_ADDRESS = "0xdBa0fC8341FBcBa64636137CBDCd8961452b54D8" as any; // sandbox

// My account based on private key
const myAccount: Account = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);

// Viem custom chain definition for Etherlink sandbox
const etherlinkSandbox = defineChain({
  id: 128123,
  name: 'EtherlinkSandbox',
  nativeCurrency: {
    decimals: 18,
    name: 'tez',
    symbol: 'xtz',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
});

// Viem objects that allow programs to call the chain
const walletClient = createWalletClient({
  account: myAccount,
  chain: etherlinkSandbox, // Or use etherlinkTestnet from "viem/chains"
  transport: http(),
});
const contract = getContract({
  address: CONTRACT_ADDRESS,
  abi: abi,
  client: walletClient,
});
const publicClient = createPublicClient({
  chain: etherlinkSandbox, // Or use etherlinkTestnet from "viem/chains"
  transport: http()
});


const DELAY = 3; // Delay in seconds between polling Hermes for price data
const CHANGE_THRESHOLD = 0.0001; // Minimum change in exchange rate that counts as a price fluctuation

// Utility functions to call read-only smart contract functions
const getBalance = async () => parseInt(await contract.read.getBalance([myAccount.address]) as string);
const getCash = async () => parseFloat(formatEther((await contract.read.getCash([myAccount.address]) as bigint))).toFixed(2);

const delaySeconds = seconds => new Promise(res => setTimeout(res, seconds*1000));

// Utility function to call Hermes and return the current price of one XTZ in USD
const getPrice = async (connection) => {
  const priceIds = [XTZ_USD_ID];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds) as PriceUpdate;
  const parsedPrice = priceFeedUpdateData.parsed![0].price;
  const actualPrice = parseInt(parsedPrice.price) * (10 ** parsedPrice.expo)
  return actualPrice;
}

// Call the cashout function to retrieve the XTZ you've sent to the contract (for tutorial purposes)
const cashout = async () => {
  console.log("My cash stored in the contract:", await getCash(), "XTZ");
  console.log("Cashing out");
  const cashoutHash = await contract.write.cashout([],
    { gas: 30000000n }
  );
  await publicClient.waitForTransactionReceipt({ hash: cashoutHash });
  console.log("Ending cash in contract:", await getCash(), "XTZ");
}

const run = async () => {

  // Check balance first
  let balance = await getBalance();
  console.log("Starting balance:", balance);
  let cash = await getCash();
  console.log("Starting cash in contract:", cash, "XTZ");
  // If not enough tokens, initialize balance with 5 fake tokens in the contract
  if (balance < 5) {
    console.log("Initializing account with 5 tez");
    const initHash = await contract.write.initAccount([myAccount.address]);
    await publicClient.waitForTransactionReceipt({ hash: initHash });
    balance = await getBalance()
    console.log("Initialized account. New balance is", balance);
  }

  const connection = new HermesClient("https://hermes.pyth.network");

  let i = 1;
  while (balance > 0 && i < 5) {
    console.log("\n");
    console.log("Iteration", i++);
    let baselinePrice = await getPrice(connection);
    console.log("Baseline price:", baselinePrice);

    const updatedPrice = await alertOnPriceFluctuations(baselinePrice, connection);
    console.log("Price changed:", updatedPrice);
    if (baselinePrice > updatedPrice) {
      // Buy
      const priceFeedUpdateData = await connection.getLatestPriceUpdates([XTZ_USD_ID]);
      console.log("Price went down; time to buy");
      const oneUSD = Math.ceil((1/updatedPrice) * 100) / 100; // Round up to two decimals
      console.log("Sending", oneUSD, "XTZ (about one USD)");
      const buyHash = await contract.write.buy(
        [[`0x${priceFeedUpdateData.binary.data[0]}`]] as any,
        { value: parseEther(oneUSD.toString()), gas: 30000000n },
      );
      await publicClient.waitForTransactionReceipt({ hash: buyHash });
      console.log("Bought one more token");
    } else if (baselinePrice < updatedPrice) {
      console.log("Price went up; time to sell");
      // Sell
      const sellHash = await contract.write.sell([],
        { gas: 30000000n }
      );
      await publicClient.waitForTransactionReceipt({ hash: sellHash });
      console.log("Sold one token");
    }
    balance = await getBalance();
  }

  // Cash out
  console.log("\n");
  await cashout();
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

run();

// Utility functions
const getContractBalance = async () => {
  const wei = await publicClient.getBalance({ address: CONTRACT_ADDRESS });
  console.log("wei", wei.toString());
  console.log("format", formatEther(wei).toString())
  const XTZRounded = parseFloat(formatEther(wei)).toFixed(2);
  console.log(XTZRounded);
}

const adminCashout = async () => {
  let contractBalance = await getContractBalance();
  console.log("Contract balance before:", contractBalance);
  await contract.write.adminCashout([],
    { gas: 30000000n }
  );
}
