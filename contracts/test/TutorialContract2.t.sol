// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test, console2 } from "forge-std/Test.sol";
import { TutorialContract } from "../src/TutorialContract2.sol";
import { MockPyth } from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract ContractToTest is Test {
  MockPyth public pyth;
  bytes32 XTZ_PRICE_FEED_ID = bytes32(uint256(0x1));
  TutorialContract public myContract;

  address public testUser = address(0x5E11E1);

  uint256 XTZ_TO_WEI = 10 ** 18;

  function setUp() public {
    pyth = new MockPyth(60, 1);
    myContract = new TutorialContract(address(pyth), XTZ_PRICE_FEED_ID);
  }

  // Utility function to create a fake Pyth price update for the test
  function createXtzUpdate(
    int64 xtzPrice
  ) private view returns (bytes[] memory) {
    bytes[] memory updateData = new bytes[](1);
    updateData[0] = pyth.createPriceFeedUpdateData(
      XTZ_PRICE_FEED_ID,
      xtzPrice * 100000, // price
      10 * 100000, // confidence
      -5, // exponent
      xtzPrice * 100000, // emaPrice
      10 * 100000, // emaConfidence
      uint64(block.timestamp), // publishTime
      uint64(block.timestamp) // prevPublishTime
    );

    return updateData;
  }

  // Utility function to set the Pyth price
  function setXtzPrice(int64 xtzPrice) private {
    bytes[] memory updateData = createXtzUpdate(xtzPrice);
    uint value = pyth.getUpdateFee(updateData);
    vm.deal(address(this), value);
    pyth.updatePriceFeeds{ value: value }(updateData);
  }

  // Set the price that 10 XTZ = 1 USD and buy
  function testBuy() public {
    int64 xtzPrice = 10;
    setXtzPrice(xtzPrice);
    bytes[] memory updateData = createXtzUpdate(xtzPrice);
    vm.deal(testUser, XTZ_TO_WEI / 10);
    vm.startPrank(testUser);
    myContract.buy{ value: XTZ_TO_WEI / 10 }(updateData);
  }

  // Test that the transaction fails if you don't send enough XTZ
  function testBuyRevert() public {
    int64 xtzPrice = 10;
    setXtzPrice(xtzPrice);
    bytes[] memory updateData = createXtzUpdate(xtzPrice);
    vm.deal(testUser, XTZ_TO_WEI / 15);
    vm.startPrank(testUser);
    vm.expectRevert();
    myContract.buy{ value: XTZ_TO_WEI / 15 }(updateData);
  }

  // Test that the transaction fails with stale data
  function testStaleData() public {
    int64 xtzPrice = 10;
    setXtzPrice(xtzPrice);
    bytes[] memory updateData = createXtzUpdate(xtzPrice);
    vm.deal(testUser, XTZ_TO_WEI / 10);
    vm.startPrank(testUser);

    // Wait until the data is stale
    skip(120);

    vm.expectRevert();
    myContract.buy{ value: XTZ_TO_WEI / 10 }(updateData);
  }

  // Test a full scenario
  function testContract() public {
    bytes[] memory updateData = createXtzUpdate(10);

    vm.deal(testUser, XTZ_TO_WEI);
    vm.startPrank(testUser);

    myContract.buy{ value: XTZ_TO_WEI / 10 }(updateData);
    myContract.buy{ value: XTZ_TO_WEI / 10 }(updateData);
    uint balance = myContract.getBalance(testUser);
    assertEq(balance, 2);
    myContract.sell(updateData);
    balance = myContract.getBalance(testUser);
    assertEq(balance, 1);

    // Test cashout
    uint256 balanceBefore = testUser.balance;
    myContract.cashout();
    uint256 balanceAfter = testUser.balance;
    assertLt(balanceBefore, balanceAfter);
  }
}
