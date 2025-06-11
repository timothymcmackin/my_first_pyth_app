import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { etherlinkTestnet } from "viem/chains";
// import { EvmPriceServiceConnection } from "@pythnetwork/hermes-client"; // This seems to be outdated in the tutorial?
import { HermesClient } from "@pythnetwork/hermes-client";
import { getContract } from "viem";

export const abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_pyth",
        type: "address",
        internalType: "address",
      },
      {
        name: "_ethUsdPriceId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "updateAndMint",
    inputs: [
      {
        name: "pythPriceUpdate",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "error",
    name: "InsufficientFee",
    inputs: [],
  },
] as const;

async function run() {
  const account = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);
  const client = createWalletClient({
    account,
    chain: etherlinkTestnet,
    transport: http(),
  });

  const contract = getContract({
    // address: process.env["DEPLOYMENT_ADDRESS"] as any,
    address: "0xC0Ca860A6BF62468b8ec0b742A672802a43D795b" as any, // Contract I deployed to Etherlink testnet
    abi: abi,
    client,
  });

  const connection = new HermesClient("https://hermes.pyth.network");
  // const priceIds = [process.env["ETH_USD_ID"] as string];
  const priceIds = ["0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as string]; // ETH-USD
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds);
  console.log("Retrieved Pyth price update:");
  console.log(priceFeedUpdateData);

  const hash = await contract.write.updateAndMint(
    [priceFeedUpdateData.binary.data as any],
    // { value: parseEther("0.0005") }
    { value: parseEther("0.5") }
  );
  console.log("Transaction hash:");
  console.log(hash);
}

run();
