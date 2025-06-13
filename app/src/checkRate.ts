import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";
import { createWalletClient, http, parseEther, getContract, createPublicClient, defineChain, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { etherlinkTestnet } from "viem/chains";

// Pyth ID for exchange rate of XTZ to USD
const XTZ_USD_ID = "0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03" as string;

// Contract I deployed
// const CONTRACT_ADDRESS = "0x02904e07a4F042FD04132231B618EeCC611EE851" as any; // testnet
const CONTRACT_ADDRESS = "0x773b3a4e9eB923E097c321dcc4Dd7Ce30D35837d" as any; //Sandbox

// My account based on private key
const myAccount = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);

const DELAY = 3; // Delay in seconds between polling Hermes for price data
const CHANGE_THRESHOLD = 0.0001; // Minimum change in exchange rate that counts as a price fluctuation

// The ABI of the compiled contract
const abi = [
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
    "name": "cash",
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
    "name": "getCash",
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

// View custom chain definition for Etherlink sandbox
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

// Viem objects that allow this program to call the chain
const walletClient = createWalletClient({
  account: myAccount,
  chain: etherlinkSandbox,
  transport: http(),
});
const contract = getContract({
  address: CONTRACT_ADDRESS,
  abi: abi,
  client: walletClient,
});
const publicClient = createPublicClient({
  chain: etherlinkSandbox,
  transport: http()
});

// Utility functions to call read-only smart contract functions
const getBalance = async (contract, address) => parseInt(await contract.read.getBalance([address]));
const getCash = async (contract, address) => parseFloat(formatEther(await contract.read.getCash([address]))).toFixed(2);

const delaySeconds = seconds => new Promise(res => setTimeout(res, seconds*1000));

// Utility function to call Hermes and return the current price of one XTZ in USD
const getPrice = async (connection) => {
  const priceIds = [XTZ_USD_ID];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds) as PriceUpdate;
  const parsedPrice = priceFeedUpdateData.parsed![0].price;
  const actualPrice = parseInt(parsedPrice.price) * (10 ** parsedPrice.expo)
  console.log ("One XTZ is worth ", actualPrice, "USD");
  return actualPrice;
}

// Call the cashout function to retrieve the XTZ you've sent to the contract (for tutorial purposes)
const cashout = async () => {
  const cashoutHash = await contract.write.cashout([]);
  await publicClient.waitForTransactionReceipt({ hash: cashoutHash });
  console.log("Cashed out.");
}

const run = async () => {

  // Check balance first
  let balance = await getBalance(contract, myAccount.address)
  console.log("Starting balance:", balance);
  let cash = await getCash(contract, myAccount.address);
  console.log("Starting cash in contract:", cash, "XTZ");
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
    console.log("Sending", oneUSD, "XTZ (about one USD)");
    const buyHash = await contract.write.buy(
      [[`0x${priceFeedUpdateData.binary.data[0]}`]] as any,
      { value: parseEther(oneUSD.toString()), gas: 30000000n },
    );
    await publicClient.waitForTransactionReceipt({ hash: buyHash });
    console.log("Bought one more token");
  } else if (baselinePrice < updatedPrice) {
    console.log("Time to sell");
    // Sell
    const sellHash = await contract.write.sell([],
      { gas: 30000000n }
    );
    await publicClient.waitForTransactionReceipt({ hash: sellHash });
    const cashoutHash = await contract.write.cashout([],
      { gas: 30000000n }
    );
    await publicClient.waitForTransactionReceipt({ hash: cashoutHash });
    const cashTx = await publicClient.getTransaction({ hash: cashoutHash});
    console.log("Received", cashTx.value.toString(), "from the contract");
  }

  // Get new balance
  balance = await getBalance(contract, myAccount.address)
  console.log("Ending balance:", balance);
  cash = await getCash(contract, myAccount.address);
  console.log("Ending cash in contract:", cash, "XTZ");
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

// cashout();

const getContractBalance = async () => {
  const wei = await publicClient.getBalance({ address: CONTRACT_ADDRESS });
  console.log("wei", wei.toString());
  console.log("format", formatEther(wei).toString())
  const XTZRounded = parseFloat(formatEther(wei)).toFixed(2);
  console.log(XTZRounded);
}

// getContractBalance();