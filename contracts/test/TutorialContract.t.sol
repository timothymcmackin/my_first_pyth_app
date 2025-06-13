// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test, console2 } from "forge-std/Test.sol";
import { TutorialContract } from "../src/TutorialContract.sol";
import { MockPyth } from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract ContractToTest is Test {
  MockPyth public pyth;
  bytes32 XTZ_PRICE_FEED_ID = bytes32(uint256(0x1));
  TutorialContract public app;

  uint256 XTZ_TO_WEI = 10 ** 18;

  function setUp() public {
    pyth = new MockPyth(60, 1);
    app = new TutorialContract(address(pyth), XTZ_PRICE_FEED_ID);
  }

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

  function setXtzPrice(int64 xtzPrice) private {
    bytes[] memory updateData = createXtzUpdate(xtzPrice);
    uint value = pyth.getUpdateFee(updateData);
    vm.deal(address(this), value);
    pyth.updatePriceFeeds{ value: value }(updateData);
  }

  function testStuff() public {
    bytes[] memory updateData = createXtzUpdate(100);
    vm.deal(address(this), XTZ_TO_WEI * 2);

    app.buy{ value: XTZ_TO_WEI / 100 }(updateData);
    app.buy{ value: XTZ_TO_WEI / 100 }(updateData);
    uint balance = app.getBalance(address(this));
    assertEq(balance, 2);
    app.sell();
    balance = app.getBalance(address(this));
    assertEq(balance, 1);

    // TODO Test cashout
  }

  function testBadCashout() public {
    vm.expectRevert();
    app.cashout();
  }
}
