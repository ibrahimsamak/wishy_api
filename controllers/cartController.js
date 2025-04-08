const boom = require("boom");
const util = require("util");
const async = require("async");
const _ = require("underscore");

const { Favorite } = require("../models/Favorite");
const { Cart } = require("../models/Cart");
const {
  Product,
  Category,
  Supplier,
  Product_Price,
  Place_Delivery,
} = require("../models/Product");
const { setting, variation } = require("../models/Constant");
const { getCurrentDateTime } = require("../models/Constant");
const { success, errorAPI } = require("../utils/responseApi");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const { check_request_params } = require("../utils/utils");


exports.getCartCount = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    var count = 0;
    var item = await Cart.find({ user_id: req.user._id })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      if (data.product_id && data.product_id != "" && data.product_id != 0) {
        var _product = await Product.findOne({
          $and: [{ _id: data.product_id }, { isDeleted: false }],
        }).populate("category_id");
        if (_product) {
          var productObject = _product.toObject();
          if (productObject) {
            count++;
          }
        }
      }
    }
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          count
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getCartTotalsUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });

    var ar_msg = "";
    var en_msg = "";
    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var statusCode = 200;
    const item = await Cart.find({
      $and: [{ user_id: req.user._id }],
    })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      var Product_Price_Object = await Product.findOne({
        $and: [
          { _id: data.product_id },
          { isDeleted: false },
        ],
      });

      if (Product_Price_Object) {
        // reply
        //   .code(200)
        //   .send(
        //     errorAPI(
        //       language,
        //       400,
        //       MESSAGE_STRING_ARABIC.ERROR,
        //       MESSAGE_STRING_ENGLISH.ERROR
        //     )
        //   );
        // return;

        // if ( Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0
        // ) {
        //   totalPrice += Number(Product_Price_Object.sale_price) * data.qty;
        // } 

        
        // if(Product_Price_Object.type && Product_Price_Object.type == 'variable'){
        //   var variable_product = await variation.findById(data.variation_id);
        //   console.log(variable_product)
        //   if(variable_product){
        //     totalPrice += Number(variable_product.regular_price) * data.qty;;
        //   }
        // }else{
          if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0) {
            totalPrice += Number(Product_Price_Object.sale_price) * data.qty;
          } 
        // }



        // deliverycost +=
        //   Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        // expresscost +=
        //   Number(Product_Price_Object.expressCost) * Number(data.qty);


        // totalPrice += data.Total;
        // totalDiscount += data.TotalDiscount;

        // var Product_Price_Object = await Product_Price.findOne({
        //   $and: [
        //     { product_id: data.product_id },
        //     { place_id: place_id },
        //     { supplier_id: supplier_id },
        //   ],
        // });

      }
    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

    var returnObject = {
      tax:  Number(sub_total_delivery * Number(tax.value)),
      deliveryCost: Number(deliverycost),
      expressCost:Number(expresscost),
      total_price: Number(parseFloat(totalPrice).toFixed(2)),
      total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
      final_total: Number(parseFloat(final_total).toFixed(2)),
      // final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
    };
    reply
      .code(200)
      .send(success(language, statusCode, ar_msg, en_msg, returnObject));
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getCartUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var ar_msg = "";
    var en_msg = "";
    var statusCode = 200;
    const tax = await setting.findOne({ code: "TAX" });

    var providerArr = [];
    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var productsCategoryMatualIds = []
    var productsIds = []
    var item = await Cart.find({ user_id: req.user._id })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      // new
      var _product = await Product.findOne({
        $and: [{ _id: data.product_id }, { isDeleted: false }],
      });
      if (_product) {
        productsIds.push(_product._id)
        productsCategoryMatualIds.push(_product.category_id._id)
        var productObject = _product.toObject();
        const checkFavorite = await Favorite.findOne({
          $and: [
            { user_id: req.user._id },
            { product_id: data.product_id },
          ],
        });
        if (checkFavorite) {
          productObject.favorite_id = checkFavorite._id;
        } else {
          productObject.favorite_id = null;
        }

        delete productObject.arName;
        delete productObject.enName;
        delete productObject.arDescription;
        delete productObject.enDescription;
        productObject.name = _product[`${language}Name`];
        productObject.description = _product[`${language}Description`];
        productObject.cart_id = data._id;
        productObject.qty = data.qty;
        productObject.Total = data.Total;
        productObject.TotalDiscount = data.TotalDiscount;
        productObject.variation_name = data.variation_name;
        productObject.variation_sku = data.variation_sku;

        // if(_product.type && _product.type == 'variable'){
        //   var variable_product = await variation.findById(data.variation_id);
        //   if(variable_product){
        //     productObject.variation = variable_product;
        //   }
        // }
        // providerobject.products.push(productObject);
        providerArr.push(productObject);
      }

      // if(_product.type && _product.type == 'variable'){
      //   var variable_product = await variation.findById(data.variation_id);
      //   if(variable_product){
      //     totalPrice += Number(variable_product.regular_price) * data.qty;;
      //   }
      // }else{
        if (_product.sale_price && _product.sale_price != 0) {
          totalPrice += Number(_product.sale_price) * data.qty;
        } 
      // }

      // totalPrice += Number(_product.sale_price) * data.qty;
      // deliverycost += 0//Number(_product.deliveryCost) * Number(data.qty);
      // expresscost +=  Number(_product.expressCost) * Number(data.qty);
    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    // let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    // var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

    var returnObject = { 
      results: providerArr,
      tax:  Number(sub_total_delivery * Number(tax.value)),
      deliveryCost: Number(deliverycost),
      // expressCost: Number(expresscost),
      total_price: Number(parseFloat(totalPrice).toFixed(2)),
      total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
      final_total: Number(parseFloat(final_total).toFixed(2)),
      // final_express_total: Number(parseFloat(final_express_total).toFixed(2))
    };

    reply.code(200).send(success(language, statusCode, ar_msg, en_msg, returnObject));
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addProduct = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [{ name: "product_id" }, { name: "qty" }];

    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var place_id = req.headers["place"];
        var supplier_id = req.headers["supplier"];
        var total = 0.0;
        var totalDiscount = 0.0;
        const userCart = await Cart.find({ user_id: req.user._id });
        const provider = await Product.findOne({ $and: [{ _id: req.body.product_id }, { isDeleted: false }]});
        if (!provider) {
          reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.ERROR,
                MESSAGE_STRING_ENGLISH.ERROR
              )
            );
          return;
        }
        const checkSupplierBefore = await Cart.find({
          $and: [
            { user_id: req.user._id },
          ],
        });
        // var supliers_ids = checkSupplierBefore.map(x=>String(x.supplier_id))
        // if(!supliers_ids.includes(String(provider.by)) && userCart.length > 0) {
        //   reply
        //   .code(200)
        //   .send(
        //     errorAPI(
        //       language,
        //       400,
        //       MESSAGE_STRING_ARABIC.MULTISPUPPLIER,
        //       MESSAGE_STRING_ENGLISH.MULTISPUPPLIER
        //     )
        //   );
        // return;
        // }
        // if(provider.type && provider.type == 'variable'){
        //     var variable_product = await variation.findById(req.body.variation_id);
        //     if(variable_product){
        //       total = Number(variable_product.regular_price) * req.body.qty;;
        //     }
        // }else{
          if (provider.sale_price && provider.sale_price != 0) {
            total = Number(provider.sale_price) * req.body.qty;
          } 
        // }
 

        const checkBefore = await Cart.findOne({
          $and: [
            { user_id: req.user._id },
            { product_id: req.body.product_id },
          ],
        });
        if (checkBefore) {
          // if(provider.type && provider.type == 'variable'){
          //   var variable_product = await variation.findById(req.body.variation_id);
          //   if(variable_product){
          //     total = Number(variable_product.regular_price) * req.body.qty;;
          //   }
          // }else{
            if (provider.sale_price && provider.sale_price != 0) {
              total = Number(provider.sale_price) * req.body.qty;
            } 
          // }
          const Carts = await Cart.findByIdAndUpdate(checkBefore._id,
            {
              $inc: { qty: 1 },
              Total: total
            },
            { new: true }
          );
          reply
            .code(200)
            .send(
              success(
                language,
                200,
                MESSAGE_STRING_ARABIC.SUCCESS,
                MESSAGE_STRING_ENGLISH.SUCCESS,
                Carts
              )
            );
          return;
        } else {
          // add new
          let _Cart = new Cart({
            user_id: req.user._id,
            product_id: req.body.product_id,
            variation_name: req.body.variation_name,
            variation_sku: req.body.variation_sku,
            // supplier_id: provider.by,
            qty: req.body.qty,
            Total: total,
            TotalDiscount: totalDiscount,
            isProduct: true,
            createAt: getCurrentDateTime(),
          });

          let rs = await _Cart.save();
          reply
            .code(200)
            .send(
              success(
                language,
                200,
                MESSAGE_STRING_ARABIC.SUCCESS,
                MESSAGE_STRING_ENGLISH.SUCCESS,
                rs
              )
            );
          return;
        }
      } else {
        reply.send(response);
      }
    });
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.UpdateCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  // try {
    var validationArray = [{ name: "Cart" }];

    // check_request_params(req.body, validationArray, async function (response) {
    //   if (response.success) {
        var total = 0.0;
        var totalDiscount = 0.0;
        //update qty
        var requestedCart = [];
        requestedCart = req.body.Cart;
        var cart_id = [];
        for await (const data of requestedCart) {
          // cart_id.push(data.cart_id);
          const item = await Cart.findById(data.cart_id);
          if (!item) {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.ERROR,
                  MESSAGE_STRING_ENGLISH.ERROR
                )
              );
            return;
          }
          var Product_Price_Object = await Product.findOne({
            $and: [
              { _id: item.product_id },
              { isDeleted: false },
            ],
          });

          if (!Product_Price_Object) {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.ERROR,
                  MESSAGE_STRING_ENGLISH.ERROR
                )
              );
            return;
          }

          // if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0
          // ) {
          //   total = Number(Product_Price_Object.sale_price) * data.qty;
          // } 

          // if(Product_Price_Object.type && Product_Price_Object.type == 'variable'){
          //   var variable_product = await variation.findById(item.variation_id);
          //   if(variable_product){
          //     total = Number(variable_product.regular_price) * data.qty;
          //   }
          // }else{
            if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0) {
              total = Number(Product_Price_Object.sale_price) * data.qty;
            } 
          // }

          await Cart.findByIdAndUpdate(
            data.cart_id,
            {
              qty: data.qty,
              Total: total,
              TotalDiscount: totalDiscount,
            },
            { new: true }
          );
        }
        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS
            )
          );
        return;
    //   } else {
    //     reply.send(response);
    //   }
    // });
  // } catch (err) {
  //   reply.code(200).send(errorAPI(language, 400, err.message, err.message));
  //   return;
  // }
};

exports.deleteCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    Cart.deleteMany(
      {
        $and: [{ user_id: req.user._id }],
      },
      function (err) {
        console.log("deleted >> ");
      }
    );

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.deleteItemCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var Carts = await Cart.findByIdAndRemove(req.query.cart_id);
    if (!Carts) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR,
            MESSAGE_STRING_ENGLISH.ERROR
          )
        );
      return;
    }
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          Carts
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
