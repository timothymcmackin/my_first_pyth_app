// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { console2 } from "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract XTZPythContract {
  IPyth pyth;
  bytes32 xtzUsdPriceId;
  address owner;

  constructor(address _pyth, bytes32 _xtzUsdPriceId, address _owner) {
    pyth = IPyth(_pyth);
    xtzUsdPriceId = _xtzUsdPriceId;
    owner = _owner;
  }

  function cashout() public {
    uint256 balance = address(this).balance;
    require(balance > 0, "No XTZ to cash out");
    (bool success, ) = owner.call{value: balance}("");
    require(success, "Transfer failed");
  }

  function mint() public payable {
    PythStructs.Price memory price = pyth.getPriceNoOlderThan(
      xtzUsdPriceId,
      60
    );

    uint xtzPrice18Decimals = (uint(uint64(price.price)) * (10 ** 18)) /
      (10 ** uint8(uint32(-1 * price.expo)));
    uint oneDollarInWei = ((10 ** 18) * (10 ** 18)) / xtzPrice18Decimals;

    console2.log("required payment in wei");
    console2.log(oneDollarInWei);
    console2.log("You sent:");
    console2.log(msg.value);

    if (msg.value >= oneDollarInWei) {
      // User paid enough money.
      // TODO: mint the NFT here
      console2.log("Thank you for sending one dollar in XTZ!");
    } else {
      revert InsufficientFee();
    }
  }

  function updateAndMint(bytes[] calldata pythPriceUpdate) external payable {
    uint updateFee = pyth.getUpdateFee(pythPriceUpdate);
    pyth.updatePriceFeeds{ value: updateFee }(pythPriceUpdate);

    mint();
  }

  // Error raised if the payment is not sufficient
  error InsufficientFee();
}
