// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { console2 } from "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract TutorialContract {
  IPyth pyth;
  bytes32 xtzUsdPriceId;
  mapping(address => uint256) balances;

  constructor(address _pyth, bytes32 _xtzUsdPriceId) {
    pyth = IPyth(_pyth);
    xtzUsdPriceId = _xtzUsdPriceId;
  }

  function getBalance(address user) public view returns (uint256) {
    return balances[user];
  }

  // Initialize accounts with 5 tokens for the sake of the tutorial
  function initAccount(address user) external {
    require(balances[msg.sender] < 5, "You already have at least 5 tokens");
    balances[user] = 5;
  }

  // Update the price
  function updatePrice(bytes[] calldata pythPriceUpdate) private {
    uint updateFee = pyth.getUpdateFee(pythPriceUpdate);
    pyth.updatePriceFeeds{ value: updateFee }(pythPriceUpdate);
  }

  // Get 1 USD in wei
  function getPrice() public view returns (uint256) {
    PythStructs.Price memory price = pyth.getPriceNoOlderThan(
      xtzUsdPriceId,
      60
    );
    uint xtzPrice18Decimals = (uint(uint64(price.price)) * (10 ** 18)) /
      (10 ** uint8(uint32(-1 * price.expo)));
    uint oneDollarInWei = ((10 ** 18) * (10 ** 18)) / xtzPrice18Decimals;
    return oneDollarInWei;
  }

  // Buy function: increments sender's balance by 1
  function buy(bytes[] calldata pythPriceUpdate) external payable {
    updatePrice(pythPriceUpdate);
    uint256 oneDollarInWei = getPrice();

    // Require 1 USD worth of XTZ
    if (msg.value >= oneDollarInWei) {
      // User paid enough money.
      balances[msg.sender] += 1;
      console2.log("Thank you for sending one dollar in XTZ!");
    } else {
      revert InsufficientFee();
    }
  }

  // Sell function: decrements sender's balance by 1
  function sell(bytes[] calldata pythPriceUpdate) external {
    require(getBalance(msg.sender) > 0, "Insufficient balance to sell");
    updatePrice(pythPriceUpdate);
    uint256 oneDollarInWei = getPrice();

    // Send the user 1 USD worth of XTZ
    require(address(this).balance > oneDollarInWei, "Not enough XTZ to send");
    (bool sent, ) = msg.sender.call{value: oneDollarInWei}("");
    require(sent, "Failed to send XTZ");
    balances[msg.sender] -= 1;
    console2.log("Sending you one dollar in XTZ");
  }

  // For tutorial purposes, cash out the XTZ in the contract
  function cashout() public {
    require(address(this).balance > 0, "No XTZ to send");
    (bool sent, ) = msg.sender.call{value: address(this).balance}("");
    require(sent, "Failed to send XTZ");
      balances[msg.sender] = 0;
  }

  // Error raised if the payment is not sufficient
  error InsufficientFee();
}