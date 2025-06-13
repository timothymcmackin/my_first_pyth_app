// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { console2 } from "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract TutorialContract {
  IPyth pyth;
  bytes32 xtzUsdPriceId;
  address owner;
  mapping(address => uint256) public balances;
  mapping(address => uint256) public cash;

  constructor(address _pyth, bytes32 _xtzUsdPriceId, address _owner) {
    pyth = IPyth(_pyth);
    xtzUsdPriceId = _xtzUsdPriceId;
    owner = _owner;
  }

  // Initialize accounts with 5 tokens to be nice
  function initAccount(address user) external {
    require(balances[msg.sender] < 5, "You already have 5 tokens");
    balances[user] = 5;
  }

  function getBalance(address user) public view returns (uint256) {
    return balances[user];
  }

  function getCash(address user) public view returns (uint256) {
    return cash[user];
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
      cash[msg.sender] += msg.value;
      console2.log("Thank you for sending one dollar in XTZ!");
    } else {
      revert InsufficientFee();
    }
  }

  // Sell function: decrements sender's balance by 1
  function sell() external {
    require(getBalance(msg.sender) > 0, "Insufficient balance to sell");
    balances[msg.sender] -= 1;
  }

  function cashout() public {
    uint256 myCash = getCash(msg.sender);
    require(myCash > 0, "No XTZ to cash out");
    (bool success, ) = owner.call{value: myCash}("");
    require(success, "Transfer failed");
  }

  // Error raised if the payment is not sufficient
  error InsufficientFee();
}