import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";
import { createWalletClient, http, parseEther, getContract, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { etherlinkTestnet } from "viem/chains";

// Pyth ID for exchange rate of XTZ to USD
const XTZ_USD_ID = "0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03" as string;

// Contract I deployed
const CONTRACT_ADDRESS = "0x02904e07a4F042FD04132231B618EeCC611EE851" as any;

const DELAY = 3; // Delay in seconds between polling Hermes for price data
const CHANGE_THRESHOLD = 0.0001; // Minimum change in exchange ratethat counts as a price fluctuation

export const publicClient = createPublicClient({
  chain: etherlinkTestnet,
  transport: http()
})

export const abi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_pyth",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_xtzUsdPriceId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balances",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "buy",
    "inputs": [
      {
        "name": "pythPriceUpdate",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "cashout",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBalance",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPrice",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initAccount",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sell",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "error",
    "name": "InsufficientFee",
    "inputs": []
  }
];

const getBalance = async (contract, address) => parseInt(await contract.read.getBalance([address]));

const run = async () => {

  const myAccount = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);
  const walletClient = createWalletClient({
    account: myAccount,
    chain: etherlinkTestnet,
    transport: http(),
  });

  const contract = getContract({
    address: CONTRACT_ADDRESS,
    abi: abi,
    client: walletClient,
  });

  // Check balance first
  let balance = await getBalance(contract, myAccount.address)
  console.log("Starting balance:", balance);
  // If not enough tokens, initialize balance with 5 fake tokens in the contract
  if (balance < 5) {
    console.log("Initializing account");
    const initHash = await contract.write.initAccount([myAccount.address]);
    await publicClient.waitForTransactionReceipt({ hash: initHash });
    balance = await getBalance(contract, myAccount.address)
    console.log("Initialized account. New balance is", balance);
  }

  const connection = new HermesClient("https://hermes.pyth.network");
  let baselinePrice = await getPrice(connection);
  console.log("Baseline price:", baselinePrice);

  const updatedPrice = await alertOnPriceFluctuations(baselinePrice, connection);
  console.log("Price changed:", updatedPrice);
  if (baselinePrice > updatedPrice) {
    // Buy
    const priceFeedUpdateData = await connection.getLatestPriceUpdates([XTZ_USD_ID]);
    console.log("Time to buy");
    const oneUSD = Math.ceil((1/updatedPrice) * 100) / 100; // Round up to two decimals
    console.log("Sending", oneUSD, "XTZ");
    const buyHash = await contract.write.buy(
      [[`0x${priceFeedUpdateData.binary.data[0]}`]] as any,
      { value: parseEther(oneUSD.toString()), gas: 30000000n },
    );
    await publicClient.waitForTransactionReceipt({ hash: buyHash });
    console.log("Bought one more token")
  } else if (baselinePrice < updatedPrice) {
    console.log("Time to sell");
    // Sell
    const sellHash = await contract.write.sell([],
      { gas: 30000000n }
    );
    await publicClient.waitForTransactionReceipt({ hash: sellHash });
  }

  // Get new balance
  balance = await getBalance(contract, myAccount.address)
  console.log("Ending balance:", balance);
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

const cashout = async () => {

  const myAccount = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);
  const walletClient = createWalletClient({
    account: myAccount,
    chain: etherlinkTestnet,
    transport: http(),
  });

  const contract = getContract({
    address: CONTRACT_ADDRESS,
    abi: abi,
    client: walletClient,
  });

  const cashoutHash = await contract.write.cashout([]);
  await publicClient.waitForTransactionReceipt({ hash: cashoutHash });
  console.log("Cashed out.");
}

// cashout();

run();
