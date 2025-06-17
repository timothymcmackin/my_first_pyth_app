// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract TutorialContract {
  IPyth pyth;
  bytes32 xtzUsdPriceId;

  constructor(address _pyth, bytes32 _xtzUsdPriceId) {
    pyth = IPyth(_pyth);
    xtzUsdPriceId = _xtzUsdPriceId;
  }

  // Update the price
  function updatePrice(bytes[] calldata pythPriceUpdate) public {
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

  // Update and get the price in a single step
  function updateAndGet(bytes[] calldata pythPriceUpdate) external payable returns (uint256) {
    updatePrice((pythPriceUpdate));
    return getPrice();
  }
}