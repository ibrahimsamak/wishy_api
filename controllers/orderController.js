// External Dependancies
const boom = require("boom");
const NodeGeocoder = require("node-geocoder");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const geolib = require("geolib");
const _ = require("underscore");
const lodash = require("lodash");
const GeoFire = require("geofire");
const async = require("async");
const moment = require("moment");
const request = require("request");
const axios = require("axios");
const mongoose = require("mongoose");

// Get Data Models
const { Favorite } = require("../models/Favorite");
const { Order, Rate, Payment } = require("../models/Order");
const { Admin } = require("../models/Admin");
// const { Point } = require("../models/Point");
// const { UserPoint } = require("../models/userPoint");
const { Notifications } = require("../models/Notifications");
const { setting, place } = require("../models/Constant");
const {
  Product,
  Supplier,
  Product_Price,
  Place_Delivery,
} = require("../models/Product");
const { getCurrentDateTime } = require("../models/Constant");
const { coupon } = require("../models/Coupon");
const { tokens } = require("../models/Constant");
// const { companyCommision } = require("../models/companyCommision");
const { Users, User_Address } = require("../models/User");
const { Cart } = require("../models/Cart");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  NOTIFICATION_TYPE,
  NOTIFICATION_TITILES,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const {
  encryptPassword,
  mail_reset_password,
  makeid,
  makeOrderNumber,
  uploadImages,
  CreateGeneralNotification,
  sendSMS,
  check_request_params,
  handleError,
  CreateNotificationMultiple,
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const { string, number } = require("@hapi/joi");
const { employee } = require("../models/Employee");
const { Firebase } = require("../utils/firebase");
const e = require("cors");
var database = Firebase.database();
var geoFire = new GeoFire(database.ref("userLocation"));

//status
/*
-1 - incomplete
 1 - pending or new
 2 - accepting by store and moving order to driver
 3 - deliverd
 4 - finish
 5 - canceled by user
 6 - reject  by driver
 7 - cancel  by driver
*/

// add new order of products
// payment type: 1. cash , 2. credit card , 3.points
// OrderType : 1.products , 2:refill
exports.addOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [
      { name: "couponCode" },
      { name: "PaymentType" },
      // { name: "dt_date" },
      // { name: "dt_time" },
      { name: "address" },
      { name: "is_address_book" },
    ];
    if (String(req.body.is_address_book) == "true") {
      validationArray.push({ name: "address_book" });
    } else {
      validationArray.push({ name: "lat" });
      validationArray.push({ name: "lng" });
    }
    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var place_id = req.headers["place"];
        var userId = req.user._id;
        const userObj = await Users.findById(userId);
        const tax = await setting.findOne({ code: "TAX" });

        const raduis = 1000;
        var cart_place_id = "";
        var supplier_id = "";
        var items = [];
        var total = 0.0;
        var totalDiscount = 0.0;
        var provider_Total = 0.0;
        var net_total = 0.0;
        var deliverycost = 0.0;
        var lat = 0.0;
        var lng = 0.0;
        var remain = 0.0;
        var gTax = 0.0;
        var address = "";
        var couponRate = 0.0;
        var sp = null;
        var personalDiscount = 0.0;

        var ar_msg = MESSAGE_STRING_ARABIC.SUCCESSNEW;
        var en_msg = MESSAGE_STRING_ENGLISH.SUCCESSNEW;
        var statusCode = 200;
        var employee_ids = [];

        var doc = req.body;
        var arr = [];
        var newPlaceId = "";
        arr = await Cart.find({
          $and: [{ user_id: userId }],
        });

        if (arr.length == 0) {
          // items on cart
          reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.EMPTY_CART,
                MESSAGE_STRING_ENGLISH.EMPTY_CART
              )
            );
          return;
        }

        for await (const data of arr) {
          supplier_id = data.supplier_id;
          //cart_place_id = data.place_id;
        }

        if (
          String(req.body.is_address_book) == "true" &&
          req.body.address_book &&
          req.body.address_book != ""
        ) {
          var newAddress = await User_Address.findById(req.body.address_book);
          if (newAddress) {
            lat = Number(newAddress.lat);
            lng = Number(newAddress.lng);
            if (newAddress.discount != 0)
              personalDiscount = Number(newAddress.discount);
          } else {
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
        } else {
          lat = Number(req.body.lat);
          lng = Number(req.body.lng);
        }

        if (lat != 0.0 && lng != 0.0) {
          // user delivery address in change
          var PoinInPolygon = await place.find({
            $and: [
              {
                loc: {
                  $geoIntersects: {
                    $geometry: {
                      type: "Point",
                      coordinates: [lng, lat],
                    },
                  },
                },
              },
              { isDeleted: false },
            ],
          });
          if (PoinInPolygon.length > 0) {
            var employeesInPlace = await employee.find({
              $and: [{ place_id: place_id }, { isAvailable: true },{ isDeleted: false }]
            });
            if (place_id == PoinInPolygon[0]._id) {
              newPlaceId = place_id;
              // same location don't doing anything .. and get nearest driver in same place and supplier
              var keys_arr = [];

              let geoQuery = geoFire.query({
                center: [Number(lat), Number(lng)],
                radius: raduis,
              });
              var onKeyEnteredRegistration = geoQuery.on(
                "key_entered",
                function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  var employees = employeesInPlace.map((x) => String(x._id));
                  if (employees.includes(key)) {
                    let obj = {
                      key: key,
                      location: location,
                      distance: distance,
                    };

                    if (distance <= raduis) {
                      keys_arr.push(obj);
                    }
                  }
                  keys_arr.sort(function (a, b) {
                    return a.distance > b.distance;
                  });
                }
              );
              var onKeyExitedRegistration = geoQuery.on(
                "ready",
                async function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  onKeyEnteredRegistration.cancel();
                  var ids = keys_arr.map((x) => x.key);
                  if (keys_arr.length > 0) {
                    await employee.find(
                      { $and: [{ _id: ids[0] },{ isDeleted: false }] },
                      async function (err, _users) {
                        supplier_id = _users[0].supplier_id;
                      }
                    );
                  } else {
                    var suppliers = await Place_Delivery.findOne({
                      place_id: newPlaceId,
                    });
                    // var supplier_id = "";
                    if (suppliers) {
                      supplier_id = suppliers.supplier_id;
                    } else {
                      reply
                        .code(200)
                        .send(
                          errorAPI(
                            language,
                            400,
                            MESSAGE_STRING_ARABIC.NOT_COVERED,
                            MESSAGE_STRING_ENGLISH.NOT_COVERED
                          )
                        );
                      return;
                    }
                  }
                }
              );
            } else {
              // change prices to new distination send it with new alert and new prices
              newPlaceId = PoinInPolygon[0]._id;
              employeesInPlace = await employee.find({
                $and: [{ place_id: newPlaceId }, { isAvailable: true },{ isDeleted: false }],
              });
              //get nearset supplier id in new place id
              var keys_arr = [];
              let geoQuery = geoFire.query({
                center: [Number(lat), Number(lng)],
                radius: raduis,
              });
              var onKeyEnteredRegistration = geoQuery.on(
                "key_entered",
                function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  var employees = employeesInPlace.map((x) => String(x._id));
                  if (employees.includes(key)) {
                    let obj = {
                      key: key,
                      location: location,
                      distance: distance,
                    };

                    if (distance <= raduis) {
                      keys_arr.push(obj);
                    }
                  }
                  keys_arr.sort(function (a, b) {
                    return a.distance > b.distance;
                  });
                }
              );
              var onKeyExitedRegistration = geoQuery.on(
                "ready",
                async function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  onKeyEnteredRegistration.cancel();
                  var ids = keys_arr.map((x) => x.key);
                  if (keys_arr.length > 0) {
                    await employee.find(
                      { $and: [{ _id: ids[0] },{ isDeleted: false }] },
                      async function (err, _users) {
                        supplier_id = _users[0].supplier_id;
                      }
                    );
                  } else {
                    var suppliers = await Place_Delivery.findOne({
                      place_id: newPlaceId,
                    });
                    // var supplier_id = "";
                    if (suppliers) {
                      supplier_id = suppliers.supplier_id;
                    } else {
                      reply
                        .code(200)
                        .send(
                          errorAPI(
                            language,
                            400,
                            MESSAGE_STRING_ARABIC.NOT_COVERED,
                            MESSAGE_STRING_ENGLISH.NOT_COVERED
                          )
                        );
                      return;
                    }
                  }
                }
              );

              for await (const data of arr) {
                var Product_Price_Object = await Product_Price.findOne({
                  $and: [
                    { place_id: newPlaceId },
                    // { supplier_id: supplier_id },
                    { product_id: data.product_id },
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

                if (
                  Product_Price_Object.discountPrice &&
                  Product_Price_Object.discountPrice != 0
                ) {
                  var totalPrice =
                    Number(Product_Price_Object.price_for_new) * data.qty;
                  var _totalDiscount = Number(
                    Product_Price_Object.discountPrice * data.qty
                  );

                  await Cart.findByIdAndUpdate(
                    data._id,
                    {
                      Total: totalPrice,
                      TotalDiscount: _totalDiscount,
                    },
                    { new: true }
                  );
                } else {
                  var totalPrice =
                    Number(Product_Price_Object.price_for_new) * data.qty;
                  await Cart.findByIdAndUpdate(
                    data._id,
                    {
                      Total: totalPrice,
                      TotalDiscount: 0,
                    },
                    { new: true }
                  );
                }
              }
            }
          } else {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.NOT_COVERED,
                  MESSAGE_STRING_ENGLISH.NOT_COVERED
                )
              );
            return;
          }
        } else {
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

        arr = await Cart.find({
          $and: [{ user_id: userId }],
        });

        if (arr.length == 0) {
          // items on cart
          reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.EMPTY_CART,
                MESSAGE_STRING_ENGLISH.EMPTY_CART
              )
            );
          return;
        }

        var provider = await Supplier.findOne({
          $and: [
            { _id: supplier_id },
            { isDeleted: false },
            { isBlock: false },
          ],
        });
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

        if (req.body.couponCode && req.body.couponCode != "") {
          // check coupon
          // var today = moment(getCurrentDateTime());
          var today = moment().tz("Asia/Riyadh");
          sp = await coupon.findOne({
            $and: [
              { dt_from: { $lt: today } },
              { dt_to: { $gt: today } },
              { coupon: req.body.couponCode },
              { place_id: newPlaceId },
            ],
          });
          if (!sp) {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.COUPON_ERROR,
                  MESSAGE_STRING_ENGLISH.COUPON_ERROR,
                  {}
                )
              );
            return;
          } else {
            const prevOrd = await Order.findOne({
              $and: [{ user_id: userId }, { couponCode: req.body.couponCode }],
            });
            if (prevOrd) {
              reply
                .code(200)
                .send(
                  errorAPI(
                    language,
                    400,
                    MESSAGE_STRING_ARABIC.COUPON_ERROR,
                    MESSAGE_STRING_ENGLISH.COUPON_ERROR,
                    {}
                  )
                );
              return;
            } else {
              couponRate = sp.discount_rate;
            }
          }
        }

        var admin_percentage = provider.orderPercentage;

        for await (const data of arr) {
          var Product_Price_Object = await Product_Price.findOne({
            $and: [
              { place_id: newPlaceId },
              // { supplier_id: supplier_id },
              { product_id: data.product_id },
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

            let object = {
              cartId: data._id,
              product_id: data.product_id,
              qty: data.qty,
              Total: data.Total,
              TotalDiscount: data.TotalDiscount,
              createAt: data.createAt,
            };

            if (
              Product_Price_Object.discountPrice &&
              Product_Price_Object.discountPrice != 0
            ) {
              total += Number(Product_Price_Object.price_for_new) * data.qty;
              totalDiscount += Number(
                Product_Price_Object.discountPrice * data.qty
              );
            } else {
              total += Number(Product_Price_Object.price_for_new) * data.qty;
            }

            if(String(req.body.isExpress) == "true"){
              deliverycost += Number(Product_Price_Object.expressCost) * Number(data.qty);
            }else{
              deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
            }
            
            net_total = total;
            items.push(object);
          }
        }

        if (personalDiscount != 0)
          deliverycost = Number(deliverycost) - Number(personalDiscount * deliverycost);

        if (couponRate != 0.0) {
          deliverycost = deliverycost - Number(deliverycost * couponRate);
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value)) 
          total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        } else {
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value)) 
          total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        }

        let adminValue = parseFloat(admin_percentage).toFixed(2) * parseFloat(total).toFixed(2);
        provider_Total = parseFloat(total).toFixed(2) - parseFloat(adminValue);
        var orderNo = `${makeOrderNumber(6)}`;
        if (keys_arr.length > 0) {
          employee_ids = keys_arr.map(x=>x.key);
        } else {
          var emp = await employee.find({
            $and:[{ isDeleted: false },{supplier_id: supplier_id}]
          });
          if (emp.length > 0) employee_ids = emp.map(x=>x._id)
        }

        if (items && items.length == 0) {
          reply
            .code(200)
            .send(
              success(
                language,
                320,
                MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER,
                MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER
              )
            );
          return;
        }

        let Orders = new Order({
          Order_no: orderNo,
          Tax: Number(gTax),
          DeliveryCost: Number(deliverycost),
          NetTotal: net_total,
          Total: total,
          TotalDiscount: totalDiscount,
          Remain: parseFloat(remain).toFixed(2),
          Admin_Total: adminValue,
          provider_Total: provider_Total,
          StatusId: 1,
          dt_date: req.body.dt_date,
          dt_time: req.body.dt_time,
          lat: lat,
          lng: lng,
          PaymentType: req.body.PaymentType,
          couponCode: req.body.couponCode,
          user_id: userId,
          createAt: getCurrentDateTime(),
          items: items,
          address: req.body.address,
          user_id: userId,
          OrderType: 1,
          place_id: newPlaceId,
          supplier_id: supplier_id,
          is_address_book: req.body.is_address_book,
          address_book: req.body.address_book,
          isExpress:req.body.isExpress
        });

        let rs = await Orders.save();
        let itemsId = items.map((x) => x.cartId);
        Cart.deleteMany({ _id: { $in: itemsId } }, function (err) {});

        let msg = "لديك طلب جديد";
        if (employee_ids.length > 0) {
          var current_employee = await employee.find({_id:{$in:employee_ids}});
        }

        var notifications_arr = []
        current_employee.forEach(element => {
          let _Notification2 = new Notifications({
            fromId: userId,
            user_id: element._id,
            title: NOTIFICATION_TITILES.ORDERS,
            msg: msg,
            dt_date: getCurrentDateTime(),
            type: NOTIFICATION_TYPE.ORDERS,
            body_parms: rs._id,
            isRead: false,
            fromName: userObj.full_name,
            toName: element.full_name,
          });
          notifications_arr.push(_Notification2)
        });
        CreateNotificationMultiple(current_employee.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id)
        await Notifications.insertMany(notifications_arr, (err, _docs) => {
          if (err) {
            return console.error(err);
          } else {
            console.log("Multiple documents inserted to Collection");
          }
        });
   
        if (place_id != newPlaceId) {
          ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
          en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
          statusCode = 300;
        }

        reply.code(200).send(success(language, statusCode, ar_msg, en_msg, sp));
        return;
      } else {
        reply.send(response);
      }
    });
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addRefillOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [
      { name: "couponCode" },
      { name: "PaymentType" },
      // { name: "dt_date" },
      // { name: "dt_time" },
      { name: "address" },
      // { name: "is_address_book", type: "boolean" },
    ];
    if (String(req.body.is_address_book) == "true") {
      validationArray.push({ name: "address_book" });
    } else {
      validationArray.push({ name: "lat" });
      validationArray.push({ name: "lng" });
    }
    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var userId = req.user._id;
        var place_id = req.headers["place"];
        var supplier_id = req.headers["supplier"];
        const userObj = await Users.findById(userId);
        const tax = await setting.findOne({ code: "TAX" });

        const raduis = 1000;
        var items = [];
        var total = 0.0;
        var totalDiscount = 0.0;
        var provider_Total = 0.0;
        var net_total = 0.0;
        var deliverycost = 0.0;
        var lat = 0.0;
        var lng = 0.0;
        var remain = 0.0;
        var address = "";
        var couponRate = 0.0;
        var sp = null;
        var newPlaceId = "";
        var statusCode = 200;
        var employee_ids = [];
        var gTax = 0.0;

        var ar_msg = MESSAGE_STRING_ARABIC.SUCCESSNEW;
        var en_msg = MESSAGE_STRING_ENGLISH.SUCCESSNEW;
        var personalDiscount = 0.0;
        var arr = req.body.items;
        var _provider = await Supplier.findOne({
          $and: [
            { _id: supplier_id },
            { isDeleted: false },
            { isBlock: false },
          ],
        });
        if (!_provider) {
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

        if (arr.length == 0) {
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

        if (
          String(req.body.is_address_book) == "true" &&
          req.body.address_book &&
          req.body.address_book != ""
        ) {
          var newAddress = await User_Address.findById(req.body.address_book);
          if (newAddress) {
            lat = Number(newAddress.lat);
            lng = Number(newAddress.lng);
            if (newAddress.discount != 0)
              personalDiscount = Number(newAddress.discount);
          } else {
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
        } else {
          lat = Number(req.body.lat);
          lng = Number(req.body.lng);
        }

        if (lat != 0.0 && lng != 0.0) {
          // user delivery address in change
          var PoinInPolygon = await place.find({
            $and: [
              {
                loc: {
                  $geoIntersects: {
                    $geometry: {
                      type: "Point",
                      coordinates: [lng, lat],
                    },
                  },
                },
              },
              { isDeleted: false },
            ],
          });
          if (PoinInPolygon.length > 0) {
            var employeesInPlace = await employee.find({
              $and: [{ place_id: place_id }, { isAvailable: true },{ isDeleted: false }],
            });
            if (place_id == PoinInPolygon[0]._id) {
              newPlaceId = place_id;
              // same location don't doing anything .. and get nearest driver in same place and supplier
              var keys_arr = [];
              let geoQuery = geoFire.query({
                center: [Number(lat), Number(lng)],
                radius: raduis,
              });
              var onKeyEnteredRegistration = geoQuery.on(
                "key_entered",
                function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  var employees = employeesInPlace.map((x) => String(x._id));
                  if (employees.includes(key)) {
                    let obj = {
                      key: key,
                      location: location,
                      distance: distance,
                    };

                    if (distance <= raduis) {
                      keys_arr.push(obj);
                    }
                  }
                  keys_arr.sort(function (a, b) {
                    return a.distance > b.distance;
                  });
                }
              );
              var onKeyExitedRegistration = geoQuery.on(
                "ready",
                async function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  onKeyEnteredRegistration.cancel();
                  var ids = keys_arr.map((x) => x.key);
                  employee_ids  = keys_arr

                  if (keys_arr.length > 0) {
                    await employee.find(
                      { $and: [{ _id: ids[0] },{ isDeleted: false }] },
                      async function (err, _users) {
                        supplier_id = _users[0].supplier_id;
                      }
                    );
                  } else {
                    var suppliers = await Place_Delivery.findOne({
                      place_id: newPlaceId,
                    });
                    // var supplier_id = "";
                    if (suppliers) {
                      supplier_id = suppliers.supplier_id;
                    } else {
                      reply
                        .code(200)
                        .send(
                          errorAPI(
                            language,
                            400,
                            MESSAGE_STRING_ARABIC.NOT_COVERED,
                            MESSAGE_STRING_ENGLISH.NOT_COVERED
                          )
                        );
                      return;
                    }
                  }
                }
              );
            } else {
              // change prices to new distination send it with new alert and new prices
              newPlaceId = PoinInPolygon[0]._id;
              employeesInPlace = await employee.find({
                $and: [{ place_id: newPlaceId }, { isAvailable: true },{ isDeleted: false }],
              });
              //get nearset supplier id in new place id

              var keys_arr = [];
              let geoQuery = geoFire.query({
                center: [Number(lat), Number(lng)],
                radius: raduis,
              });
              var onKeyEnteredRegistration = geoQuery.on(
                "key_entered",
                function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  var employees = employeesInPlace.map((x) => String(x._id));
                  if (employees.includes(key)) {
                    let obj = {
                      key: key,
                      location: location,
                      distance: distance,
                    };

                    if (distance <= raduis) {
                      keys_arr.push(obj);
                    }
                  }
                  keys_arr.sort(function (a, b) {
                    return a.distance > b.distance;
                  });
                }
              );
              var onKeyExitedRegistration = geoQuery.on(
                "ready",
                async function (key, location, distance) {
                  console.log(
                    key +
                      " Key " +
                      location +
                      " (" +
                      distance +
                      " km from center)"
                  );
                  onKeyEnteredRegistration.cancel();
                  var ids = keys_arr.map((x) => x.key);
                  employee_ids = keys_arr
                  if (keys_arr.length > 0) {
                    await employee.find(
                      { $and: [{ _id: ids[0] },{ isDeleted: false }] },
                      async function (err, _users) {
                        supplier_id = _users[0].supplier_id;
                      }
                    );
                  } else {
                    var suppliers = await Place_Delivery.findOne({
                      place_id: newPlaceId,
                    });
                    // var supplier_id = "";
                    if (suppliers) {
                      supplier_id = suppliers.supplier_id;
                    } else {
                      reply
                        .code(200)
                        .send(
                          errorAPI(
                            language,
                            400,
                            MESSAGE_STRING_ARABIC.NOT_COVERED,
                            MESSAGE_STRING_ENGLISH.NOT_COVERED
                          )
                        );
                      return;
                    }
                  }
                }
              );

              for await (const data of arr) {
                var Product_Price_Object = await Product_Price.findOne({
                  $and: [
                    { place_id: newPlaceId },
                    // { supplier_id: supplier_id },
                    { product_id: data.product_id },
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

                  if (
                    Product_Price_Object.discountPriceReplacement &&
                    Product_Price_Object.discountPriceReplacement != 0
                  ) {
                    var totalPrice =
                      Number(Product_Price_Object.price_for_replacment) *
                      data.qty;
                    var _totalDiscount = Number(
                      Product_Price_Object.discountPriceReplacement * data.qty
                    );

                    await Cart.findByIdAndUpdate(
                      data._id,
                      {
                        Total: totalPrice,
                        TotalDiscount: _totalDiscount,
                      },
                      { new: true }
                    );
                  } else {
                    var totalPrice =
                      Number(Product_Price_Object.price_for_replacment) *
                      data.qty;
                    await Cart.findByIdAndUpdate(
                      data._id,
                      {
                        Total: totalPrice,
                        TotalDiscount: 0,
                      },
                      { new: true }
                    );
                  }
                }
              }
            }
          } else {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.NOT_COVERED,
                  MESSAGE_STRING_ENGLISH.NOT_COVERED
                )
              );
            return;
          }
        } else {
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

        for await (const data of arr) {
          // const provider = await Product.findById(data.product_id);
          var Product_Price_Object = await Product_Price.findOne({
            $and: [
              { place_id: newPlaceId },
              // { supplier_id: supplier_id },
              { product_id: data.product_id },
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

            if (
              Product_Price_Object.discountPriceReplacment &&
              Product_Price_Object.discountPriceReplacment != 0
            ) {
              total =
                Number(Product_Price_Object.price_for_replacment) * data.qty;
              var discount =
                Number(Product_Price_Object.price_for_replacment) * data.qty;
              totalDiscount =
                discount -
                Number(Product_Price_Object.discountPriceReplacment * data.qty);
            } else {
              total =
                Number(Product_Price_Object.price_for_replacment) * data.qty;
            }

            if(String(req.body.isExpress) == "true"){
              deliverycost += Number(Product_Price_Object.expressCost) * Number(data.qty);
            }else{
              deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
            }

            let object = {
              product_id: data.product_id,
              qty: data.qty,
              Total: total,
              TotalDiscount: totalDiscount,
              createAt: getCurrentDateTime(),
            };

            net_total = total;
            items.push(object);
          }
        }

        if (req.body.couponCode && req.body.couponCode != "") {
          // check coupon
          // var today = moment(getCurrentDateTime());
          var today = moment().tz("Asia/Riyadh");
          sp = await coupon.findOne({
            $and: [
              { dt_from: { $lt: today } },
              { dt_to: { $gt: today } },
              { place_id: newPlaceId },
              { coupon: req.body.couponCode },
            ],
          });
          if (!sp) {
            const response = {
              items: {},
              status: false,
              status_code: 400,
              messageEn: "Sorry .. Coupon is not valid",
              messageAr: "عذرا .. الكوبون غير متاح",
            };
            reply.code(200).send(response);
          } else {
            couponRate = sp.discount_rate;
          }
        }

        totalDiscount = 0.0;
        total = 0.0;
        items.forEach((element) => {
          total += element.Total;
          totalDiscount += element.TotalDiscount;
          net_total = total;
        });

        if (personalDiscount != 0)
          deliverycost =
            Number(deliverycost) - Number(personalDiscount * deliverycost);

        if (couponRate != 0.0) {
          deliverycost = deliverycost - Number(deliverycost * couponRate);
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value))
          total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        } else {
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value))
          total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        }

        var admin_percentage = Number(_provider.orderPercentage);
        let adminValue =
          parseFloat(admin_percentage).toFixed(2) *
          parseFloat(total).toFixed(2);
        provider_Total = parseFloat(total).toFixed(2) - parseFloat(adminValue);
        var orderNo = `${makeOrderNumber(6)}`;
        var employee_id = "";
        if (keys_arr.length > 0) {
          employee_ids = keys_arr.map(x=>x.key);
        } else {
          var emp = await employee.find({
            $and:[{ isDeleted: false },{supplier_id: supplier_id}]
          });
          if (emp.length > 0) employee_ids = emp.map(x=>x._id);
        }

        let Orders = new Order({
          Order_no: orderNo,
          Tax: Number(gTax),
          DeliveryCost: Number(deliverycost),
          Total: total,
          TotalDiscount: totalDiscount,
          Remain: parseFloat(remain).toFixed(2),
          Admin_Total: adminValue,
          provider_Total: provider_Total,
          NetTotal: net_total,
          StatusId: 1,
          dt_date: req.body.dt_date,
          dt_time: req.body.dt_time,
          lat: lat,
          lng: lng,
          PaymentType: req.body.PaymentType,
          couponCode: req.body.couponCode,
          user_id: userId,
          createAt: getCurrentDateTime(),
          items: items,
          address: req.body.address,
          OrderType: 2,
          place_id: newPlaceId,
          supplier_id: supplier_id,
          is_address_book: req.body.is_address_book,
          address_book: req.body.address_book,
          isExpress:req.body.isExpress

        });

        let rs = await Orders.save();

        let msg = "لديك طلب جديد";
        if (employee_ids.length > 0) {
          var current_employee = await employee.find({_id:{$in:employee_ids}});
        }

        var notifications_arr = []
        current_employee.forEach(element => {
          let _Notification2 = new Notifications({
            fromId: userId,
            user_id: element._id,
            title: NOTIFICATION_TITILES.ORDERS,
            msg: msg,
            dt_date: getCurrentDateTime(),
            type: NOTIFICATION_TYPE.ORDERS,
            body_parms: rs._id,
            isRead: false,
            fromName: userObj.full_name,
            toName: element.full_name,
          });
          notifications_arr.push(_Notification2)
        });
        CreateNotificationMultiple(current_employee.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id)
        await Notifications.insertMany(notifications_arr, (err, _docs) => {
          if (err) {
            return console.error(err);
          } else {
            console.log("Multiple documents inserted to Collection");
          }
        });
   

        if (place_id != newPlaceId) {
          ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
          en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
          statusCode = 300;
        }

        reply.code(200).send(success(language, statusCode, ar_msg, en_msg, sp));
      } else {
        reply.send(response);
      }
    });
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

//admin
exports.updateOrderByAdmin = async (req, reply) => {
  try {
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        StatusId: req.body.StatusId,
      },
      { new: false }
    )
      .populate("supplier_id")
      .populate("user_id");

    var msg = `تم اضافة طلب جديد اليك`;
    var msg2 = `تم قبول طلبك بنجاح`;

    if (req.body.StatusId == 4 && sp.StatusId != 4) {
      //add to transaction payments
      let currentDate = new Date();
      let currentMonth = moment(currentDate).format("MM");
      let currentYear = moment(currentDate).format("YYYY");
      var checkPayment = await PaymnetLog.findOne({
        $and: [
          {
            supplier_id: sp.supplier_id._id,
          },
          { PeriodMonth: currentMonth },
          { PeriodYear: currentYear },
        ],
      });

      if (checkPayment) {
        //update increament
        await PaymnetLog.findByIdAndUpdate(
          checkPayment._id,
          {
            $inc: {
              Total: Number(sp.Total),
              Admin_Total: Number(sp.Admin_Total),
              provider_Total: Number(sp.provider_Total),
            },
          },
          { new: true }
        );
      } else {
        //add payment logs
        let _Payment = new PaymnetLog({
          supplier_id: sp.supplier_id._id,
          Total: sp.Total,
          Admin_Total: sp.provider_Total,
          provider_Total: sp.provider_Total,
          TotalPaied: 0,
          TotalRemain: 0,
          PeriodMonth: moment(currentDate).format("MM"),
          PeriodYear: moment(currentDate).format("YYYY"),
          createAt: getCurrentDateTime(),
        });
        _Payment.save();
      }
    }

    // if (sp.user_id.isEnableNotifications == true) {
      CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.addOrdertoEmployee = async (req, reply) => {
  try {
    const employee = await employees.findById({ _id: req.body.employee_id });
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        employee_id: req.body.employee_id,
        StatusId: 1,
      },
      { new: true }
    )
      .populate("supplier_id")
      .populate("user_id");

    var msg = `تم اضافة طلب جديد اليك`;
    var msg2 = `تم قبول طلبك بنجاح`;

    CreateGeneralNotification(
      employee.fcmToken,
      NOTIFICATION_TITILES.ORDERS,
      msg,
      NOTIFICATION_TYPE.ORDERS,
      sp._id,
      sp.supplier_id._id,
      employee._id,
      sp.supplier_id.name,
      employee.full_name
    );

    // if (sp.user_id.isEnableNotifications == true) {
      CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }
    const response = {
      status_code: 200,
      status: true,
      messageAr: "تم تعديل الطلب بنجاح",
      messageEn: "Update Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.adminCancelOrder = async (req, reply) => {
  try {
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        StatusId: 5,
      },
      { new: true }
    )
      .populate("supplier_id", "-token")
      .populate("user_id", "-token");

    var msg2 = `عذرا ..  تم رفض طلبك `;

    // if (sp.user_id.isEnableNotifications == true) {
      CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }
    const response = {
      status_code: 200,
      status: true,
      message: "تم تعديل الطلب بنجاح",
      messageAr: "تم تعديل الطلب بنجاح",
      messageEn: "Update Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// update order status
exports.updateOrderByUser = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var userId = req.user._id;
    const orderDetails = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token");

    if (!orderDetails) {
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

    if (!req.body) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
          )
        );
      return;
    }

    if (String(req.body.StatusId) != "5") {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.WRONG_STATUS,
            VALIDATION_MESSAGE_ENGLISH.WRONG_STATUS
          )
        );
      return;
    }

    var minutesSettings = await setting.findOne({ code: "PERIOD" });
    var date = moment(getCurrentDateTime());
    // var date = moment(getCurrentDateTime());
    var OrderCrateAt = moment(orderDetails.createAt);
    var duration = moment.duration(date.diff(OrderCrateAt));
    var minutes = duration.asMinutes();

    if (minutes < Number(minutesSettings.value)) {
      if (orderDetails.StatusId == -1 ||  orderDetails.StatusId == 1 || orderDetails.StatusId == 2) {
        if (req.body.StatusId == 5) {
          const sp = await Order.findByIdAndUpdate(
            req.params.id,
            {
              StatusId: req.body.StatusId,
            },
            {
              new: true,
            }
          );

          // notification for provider
          var msg = `قام ${orderDetails.user_id.full_name} بالغاء الطلب رقم: ${sp.Order_no}`;

          // CreateGeneralNotification(
          //   orderDetails.supplier_id.fcmToken,
          //   NOTIFICATION_TITILES.ORDERS,
          //   msg,
          //   NOTIFICATION_TYPE.ORDERS,
          //   orderDetails._id,
          //   orderDetails.user_id._id,
          //   orderDetails.supplier_id._id,
          //   orderDetails.user_id.full_name,
          //   orderDetails.supplier_id.name
          // );

          let _Notification2 = new Notifications({
            fromId: orderDetails.user_id._id,
            user_id: USER_TYPE.PANEL,
            title: NOTIFICATION_TITILES.ORDERS,
            msg: msg,
            dt_date: getCurrentDateTime(),
            type: NOTIFICATION_TYPE.ORDERS,
            body_parms: orderDetails._id,
            isRead: false,
            fromName: orderDetails.user_id.full_name,
            toName: USER_TYPE.PANEL,
          });

          _Notification2.save();

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
        }
      } else {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.CANCEL_ORDER_FAILED,
              MESSAGE_STRING_ENGLISH.CANCEL_ORDER_FAILED
            )
          );
        return;
      }
      // const providerobj = await Supplier.findById(
      //   orderDetails.supplier_id._id
      // );
      // var msg = "";
      // console.log(providerobj.fcmToken);
      // if (req.body.StatusId == 5) {
      //   msg = `قام ${orderDetails.user_id.full_name} بالغاء الطلب رقم: ${orderDetails.Order_no}`;
      // } else {
      //   msg = `قام ${orderDetails.user_id.full_name} بتاكيد استلام الطلب رقم: ${orderDetails.Order_no}`;
      // }

      // CreateNotification(
      //   orderDetails.supplier_id.fcmToken,
      //   msg,
      //   orderDetails._id,
      //   orderDetails.user_id._id,
      //   orderDetails.supplier_id._id,
      //   orderDetails.user_id.full_name,
      //   orderDetails.supplier_id.name
      // );

      // const response = {
      //   status_code: 200,
      //   status: true,
      //   messageAr: "تم الغاء الطلب بنجاح",
      //   messageEn: "Order canceled sucessfully",
      //   items: sp,
      // };
      // reply.send(response);
    } else {
      let messageAr =
        "عذرا .. لقد تجاوزت الفترة المسموحة لك فيها بالغاء الطلب وهي " +
        minutesSettings.value +
        " دقيقة ";
      let messageEn =
        "Sorry .. you can't canceled order because you exceed period which is" +
        minutesSettings.value +
        " minutes";
      reply.code(200).send(errorAPI(language, 400, messageAr, messageEn));
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// exports.addOrdertoEmployee = async (req, reply) => {
//   try {
//     let emp_id = req.user._id;
//     const employee = await employee.findById(emp_id);
//     const sp = await Order.findByIdAndUpdate(
//       req.params.id,
//       {
//         employee_id: emp_id,
//         StatusId: req.body.StatusId,
//       },
//       { new: true }
//     )
//       .populate("supplier_id", "-token")
//       .populate("user_id", "-token");

//     var msg = `تم اضافة طلب جديد اليك`;
//     var msg2 = `تم قبول طلبك بنجاح`;

//     CreateGeneralNotification(
//       employee.fcmToken,
//       NOTIFICATION_TITILES.ORDERS,
//       msg,
//       NOTIFICATION_TYPE.ORDERS,
//       sp._id,
//       sp.supplier_id._id,
//       employee._id,
//       sp.supplier_id.name,
//       employee.full_name
//     );

//     if (sp.user_id.isEnableNotifications == true) {
//       CreateGeneralNotification(
//         sp.user_id.fcmToken,
//         NOTIFICATION_TITILES.ORDERS,
//         msg2,
//         NOTIFICATION_TYPE.ORDERS,
//         sp._id,
//         sp.supplier_id._id,
//         sp.user_id._id,
//         sp.supplier_id.name,
//         sp.user_id.full_name
//       );
//     }

//     reply
//       .code(200)
//       .send(
//         success(
//           language,
//           200,
//           MESSAGE_STRING_ARABIC.SUCCESS,
//           MESSAGE_STRING_ENGLISH.SUCCESS,
//           sp
//         )
//       );
//     return;
//   } catch (err) {
//     throw boom.boomify(err);
//   }
// };

// Get user Order
exports.getUserOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {};
    if (Number(req.query.StatusId) == 2 || Number(req.query.StatusId) == 3) {
      query = {
        $and: [{ user_id: userId }, { StatusId: { $in: [2, 3] } }],
      };
    } else if (Number(req.query.StatusId) == 5) {
      query = {
        $and: [{ user_id: userId }, { StatusId: { $in: [5, 6, 7] } }],
      };
    } else if (Number(req.query.StatusId) == 4) {
      query = {
        $and: [{ user_id: userId }, { StatusId: 4 }],
      };
    } 
    else {
      if (Number(req.query.StatusId) == 1 || Number(req.query.StatusId) == -1) {
        query = {
          $and: [{ user_id: userId }, { StatusId: { $in: [1, -1] } }],
        };
     }
    }

    // if (req.query.StatusId && req.query.StatusId != "") {
    //   query = {
    //     $and: [{ user_id: userId }, { StatusId: req.query.StatusId }],
    //   };
    // } else {
    //   reply
    //     .code(200)
    //     .send(
    //       errorAPI(
    //         language,
    //         400,
    //         MESSAGE_STRING_ARABIC.ENTER_STATUS,
    //         MESSAGE_STRING_ENGLISH.ENTER_STATUS,
    //         []
    //       )
    //     );
    //   return;
    // }

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit)
      .select("-couponCode");
    var arr = [];
    item.forEach((element) => {
      let obj = {
        _id: element._id,
        Order_no: element.Order_no,
        Total: element.Total,
        StatusId: element.StatusId,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        OrderType: element.OrderType,
        supplier_id: element.supplier_id,
        isExpress: element.isExpress,
      };
      arr.push(obj);
    });
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        arr,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// Get Order Details
exports.getOrderDetails = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var providerArr = [];
    var isRate = false;
    var isChatEnabled = false;
    var isTrackingEnabled = false;

    var rate = await Rate.findOne({
      $and: [{ order_id: req.params.id }, { type: 1 }],
    });

    if (rate) {
      isRate = true;
    }

    var item = await Order.findById(req.params.id)
      .populate("employee_id", "-token")
      .populate("user_id", "-token")
      .lean();
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
    if (item.StatusId == 2 || item.StatusId == 3) {
      isChatEnabled = true;
      isTrackingEnabled = true;
    }
    for await (const data of item.items) {
      var ProviderArrIndex = _.findIndex(providerArr, function (_item) {
        return String(_item.supplier_id) == String(item.supplier_id);
      });
      if (ProviderArrIndex >= 0) {
        //exsits
        var product = await Product.findOne({
          $and: [{ _id: data.product_id }, { isDeleted: false }],
        })
          .populate("by_user_id", "-token")
          .populate("category_id");

        if (product) {
          const newObj = product.toObject();
          const checkFavorite = await Favorite.findOne({
            $and: [{ user_id: req.user._id }, { product_id: product._id }],
          });
          if (checkFavorite) {
            newObj.favorite_id = checkFavorite._id;
          } else {
            newObj.favorite_id = null;
          }

          var cateogory = {
            _id: product.category_id._id,
            name: product.category_id[`${language}Name`],
            image: product.category_id.image ? product.category_id.image : "",
          };

          delete newObj.arName;
          delete newObj.enName;
          delete newObj.arDescription;
          delete newObj.enDescription;
          newObj.discountPrice = 0;
          newObj.price_for_new = 0;
          newObj.price_for_replacment = 0;
          newObj.name = product[`${language}Name`];
          newObj.description = product[`${language}Description`];
          newObj.category_id = cateogory;
          newObj.qty = data.qty;
          newObj.Total = data.Total;
          newObj.TotalDiscount = data.TotalDiscount;
          providerArr[ProviderArrIndex].products.push(newObj);
        }
      } else {
        // new
        var provider_data = await Supplier.findOne({
          $and: [
            { _id: item.supplier_id },
            { isDeleted: false },
            { isBlock: false },
          ],
        }).select(["-token", "-password", "-cities"]);

        if (!provider_data) {
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
        var providerobject = provider_data.toObject();

        providerobject._id = item._id;
        providerobject.supplier_id = item.supplier_id;
        providerobject.Order_no = item.Order_no;
        providerobject.lat = item.lat;
        providerobject.lng = item.lng;
        providerobject.dt_date = item.dt_date;
        providerobject.dt_time = item.dt_time;
        providerobject.Total = item.Total;
        providerobject.TotalDiscount = item.TotalDiscount;
        providerobject.StatusId = item.StatusId;
        providerobject.PaymentType = item.PaymentType;
        providerobject.OrderType = item.OrderType;
        providerobject.address = item.address;
        providerobject.employee_id = item.employee_id;
        providerobject.client_id = item.user_id._id;
        providerobject.client_name = item.user_id.full_name;
        providerobject.client_phone_number = item.user_id.phone_number;
        providerobject.client_image = item.user_id.image;
        providerobject.client_fcmToken = item.user_id.fcmToken;
        providerobject.isRate = isRate;
        providerobject.isExpress = item.isExpress;
        providerobject.products = [];

        var _product = await Product.findOne({
          $and: [{ _id: data.product_id }, { isDeleted: false }],
        })
          .populate("by_user_id", "-token")
          .populate("category_id");
        if (_product) {
          const newObj = _product.toObject();
          const checkFavorite = await Favorite.findOne({
            $and: [{ user_id: req.user._id }, { product_id: _product._id }],
          });
          if (checkFavorite) {
            newObj.favorite_id = checkFavorite._id;
          } else {
            newObj.favorite_id = null;
          }

          var cateogory = {
            _id: _product.category_id._id,
            name: _product.category_id[`${language}Name`],
            image: _product.category_id.image ? _product.category_id.image : "",
          };

          delete newObj.arName;
          delete newObj.enName;
          delete newObj.arDescription;
          delete newObj.enDescription;
          newObj.discountPrice = 0;
          newObj.price_for_new = 0;
          newObj.price_for_replacment = 0;
          newObj.name = _product[`${language}Name`];
          newObj.description = _product[`${language}Description`];
          newObj.category_id = cateogory;
          newObj.qty = data.qty;
          newObj.Total = data.Total;
          newObj.TotalDiscount = data.TotalDiscount;

          providerobject.products.push(newObj);
          providerArr.push(providerobject);
        }
      }
    }
    const response = {
      items: providerArr,
      tax: Number(item.Tax),
      deliveryCost: Number(item.DeliveryCost),
      total_price: Number(parseFloat(item.NetTotal).toFixed(2)),
      total_discount: Number(parseFloat(item.TotalDiscount).toFixed(2)),
      final_total: Number(parseFloat(item.Total).toFixed(2)),
      isChatEnabled: isChatEnabled,
      isTrackingEnabled: isTrackingEnabled,
      isRated: isRate,
    };

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          response
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getUserRatedOrders = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    query["type"] = 1;
    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("order_id")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "order_id.product_id",
        populate: { path: "product_id" },
      })
      .skip(page * limit)
      .limit(limit);
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getProviderRatedOrders = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    var query = {};
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    query["type"] = 2;
    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("order_id")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "order_id.product_id",
        populate: { path: "product_id" },
      })
      .skip(page * limit)
      .limit(limit);
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getNewOrder = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    const total = await Order.find({$or: [{ StatusId: 1 }, {StatusId: -1}]}).countDocuments();
    reply.send(total);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getOrdersSeacrhExcel = async (req, reply) => {
  try {
    // const admin_id = req.params.id;

    // var page = parseFloat(req.query.page, 10);
    // var limit = parseFloat(req.query.limit, 10);

    var start_date = req.body.start_date;
    var end_date = req.body.end_date;
    var query = {};

    if (end_date != "" && end_date != undefined && end_date) {
      end_date = new Date(end_date);
      end_date = end_date.setHours(23, 59, 59, 999);
      end_date = new Date(end_date);
      query = { dt_date: { $lt: end_date } };
    }
    if (start_date != "" && start_date != undefined && start_date) {
      start_date = new Date(start_date);
      start_date = start_date.setHours(0, 0, 0, 0);
      start_date = new Date(start_date);
      query = {
        dt_date: { $gte: start_date },
      };
    }
    if (
      start_date != "" &&
      start_date != undefined &&
      start_date &&
      end_date != "" &&
      end_date != undefined &&
      end_date
    ) {
      query = {
        dt_date: { $gte: start_date, $lt: end_date },
      };
    }
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    if (req.body.StatusId && req.body.StatusId != "") {
      query["StatusId"] = req.body.StatusId;
    }

    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id")
      .populate("supplier_id")
      .populate("employee_id")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.unit", populate: { path: "unit" } })
      .populate({ path: "supplier_id", populate: { path: "type_id" } });
    const response = {
      items: item,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};

exports.getOrdersSeacrh = async (req, reply) => {
  try {
    // const admin_id = req.params.id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var start_date = req.body.start_date;
    var end_date = req.body.end_date;
    var query = {};

    if (end_date != "" && end_date != undefined && end_date) {
      end_date = new Date(end_date);
      end_date = end_date.setHours(23, 59, 59, 999);
      end_date = new Date(end_date);
      query = { dt_date: { $lt: end_date } };
    }
    if (start_date != "" && start_date != undefined && start_date) {
      start_date = new Date(start_date);
      start_date = start_date.setHours(0, 0, 0, 0);
      start_date = new Date(start_date);
      query = {
        dt_date: { $gte: start_date },
      };
    }
    if (
      start_date != "" &&
      start_date != undefined &&
      start_date &&
      end_date != "" &&
      end_date != undefined &&
      end_date
    ) {
      query = {
        dt_date: { $gte: start_date, $lt: end_date },
      };
    }
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    if (req.body.StatusId && req.body.StatusId != "") {
      query["StatusId"] = req.body.StatusId;
    }

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.color_id", populate: { path: "color_id" } })
      .populate({ path: "items.size_id", populate: { path: "size_id" } })
      .populate({ path: "items.unit", populate: { path: "unit" } })
      .populate({ path: "supplier_id", populate: { path: "category_id" } })
      .skip(page * limit)
      .limit(limit);
    const response = {
      items: item,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};

exports.getEmployeeOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;
    var result = [];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    const place_id = req.headers["place"];
    const supplier_id = req.headers["supplier"];

    var query = {};
    if (Number(req.query.StatusId) == 2 || Number(req.query.StatusId) == 3) {
      query = {
        $and: [{employee_id:userId},{StatusId: { $in: [2, 3] } }],
      };
    } else if (Number(req.query.StatusId) == 5) {
      query = {
        $and: [{supplier_id:supplier_id},{place_id:place_id},{ StatusId: { $in: [5, 6, 7] } }],
      };
    } else {
      if (Number(req.query.StatusId) == -1) {
        query = {
          $and: [{supplier_id:supplier_id}, {place_id:place_id} , {StatusId: -1}],
        };
      }else{
        query = {
          $and: [{employee_id:userId}, {StatusId: req.query.StatusId }],
        };
      }
    }

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("supplier_id", "-token")
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "items.product_id",
        populate: { path: "product_id" },
      })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit)
      .select("-couponCode");
    var arr = [];
    item.forEach((element) => {
      let obj = {
        _id: element._id,
        Order_no: element.Order_no,
        Total: element.Total,
        StatusId: element.StatusId,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        OrderType: element.OrderType,
        supplier_id: element.supplier_id,
        client_name: element.user_id.full_name ? element.user_id.full_name : "",
        client_phone: element.user_id.phone_number
          ? element.user_id.phone_number
          : "",
        isExpress:element.isExpress
      };
      arr.push(obj);
    });
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        arr,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getEmployeeOrderCounters = async (req, reply) => {
  try {
    let userId = req.user._id;

    var all = await Order.find({
      $and: [{ employee_id: userId }],
    }).countDocuments();
    var finished = await Order.find({
      $and: [{ employee_id: userId }, { StatusId: 4 }],
    }).countDocuments();
    var canceled = await Order.find({
      $and: [{ employee_id: userId }, { StatusId: 5 }],
    }).countDocuments();
    var running = await Order.find({
      $and: [
        { employee_id: userId },
        { $or: [{ StatusId: 2 }, { StatusId: 3 }] },
      ],
    }).countDocuments();

    var object = {
      allOrder: all,
      finished: finished,
      canceled: canceled,
      running: running,
    };
    const response = {
      status_code: 200,
      status: true,
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done successfully",
      items: object,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOrderByEmployee = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var userId = req.user._id;
    const orderDetails = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token");

    if (!orderDetails) {
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
    if(orderDetails.employee_id && orderDetails.employee_id._id != userId){
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          VALIDATION_MESSAGE_ARABIC.ACCEPTED_BEFORE,
          VALIDATION_MESSAGE_ENGLISH.ACCEPTED_BEFORE
        )
      );
    return;
    } 
    // 1: accepted
    // 3: deliverd
    // 4: Finish

    if (!req.body) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
          )
        );
      return;
    }

    if (
      String(req.body.StatusId) != "1" &&
      String(req.body.StatusId) != "2" &&
      String(req.body.StatusId) != "3" &&
      String(req.body.StatusId) != "4" &&
      String(req.body.StatusId) != "6" &&
      String(req.body.StatusId) != "7"
    ) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.WRONG_STATUS,
            VALIDATION_MESSAGE_ENGLISH.WRONG_STATUS
          )
        );
      return;
    }

    // notification
    var msg = "";
    if (String(req.body.StatusId) == "1" && orderDetails.StatusId == -1) {
      msg = ` تم قبول طلبكم ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "2" && orderDetails.StatusId == 1) {
      msg = ` جاري تجهيز طلبكم ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "3" && orderDetails.StatusId == 2) {
      msg = `تم البدء في توصيل الطلب ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "4" && orderDetails.StatusId == 3) {
      msg = `تم الانتهاء من توصيل الطلب المطلوب من طرفكم يرجى اضافة التقييم`;
    } else if (String(req.body.StatusId) == "6" && orderDetails.StatusId == 1) {
      msg = `تم رفض طلبكم ${orderDetails.Order_no}`;
    } else if (String(req.body.StatusId) == "7" && orderDetails.StatusId == 2) {
      msg = `تم الغاء طلبكم ${orderDetails.Order_no}`;
    } else {
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
    var sp;
    if(req.body.StatusId == 1){
       sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.StatusId,
          employee_id: userId,
        },
        { new: true }
      );
    }else{
       sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.StatusId,
        },
        { new: true }
      );
    }
  
    // if (orderDetails.user_id.isEnableNotifications == true) {
      CreateGeneralNotification(
        orderDetails.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        orderDetails._id,
        userId,
        orderDetails.user_id._id,
        "",
        orderDetails.user_id.full_name
      );
    // }

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          sp
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// add Rate of Orders and products
exports.addRateFromUserToEmployee = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const ord = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token");
    if (!ord) {
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
    if (ord.StatusId == 4) {
      var checkBefore = await Rate.findOne({
        $and: [{ order_id: ord._id }, { user_id: ord.user_id }, { type: 1 }],
      });

      if (checkBefore) {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.RATE_BEFORE,
              MESSAGE_STRING_ENGLISH.RATE_BEFORE
            )
          );
        return;
      }

      if (!req.body.rate_from_user_to_provider) {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
              VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
            )
          );
        return;
      }
      let Rates = new Rate({
        order_id: ord._id,
        user_id: ord.user_id,
        supplier_id: ord.supplier_id,
        rate_from_user_to_provider: req.body.rate_from_user_to_provider,
        note_from_user_to_provider: req.body.note_from_user_to_provider,
        createAt: getCurrentDateTime(),
        type: 1,
      });

      let rs = await Rates.save();
      var totalRates = await Rate.find({
        $and: [{ supplier_id: ord.supplier_id }, { type: 1 }],
      }).countDocuments();
      var summation = await Rate.find({
        $and: [{ supplier_id: ord.supplier_id }, { type: 1 }],
      });
      let sum = lodash.sumBy(summation, function (o) {
        return o.rate_from_user_to_provider;
      });

      await Supplier.findByIdAndUpdate(ord.supplier_id, {
        rate: Number(sum / totalRates).toFixed(1),
      });

      var msg = `تمت اضافة تعليق جديد على طلب رقم: ${ord.Order_no}`;
      let _Notification2 = new Notifications({
        fromId: ord.user_id._id,
        user_id: USER_TYPE.PANEL,
        title: NOTIFICATION_TITILES.ORDERS,
        msg: msg,
        dt_date: getCurrentDateTime(),
        type: NOTIFICATION_TYPE.ORDERS,
        body_parms: ord._id,
        isRead: false,
        fromName: ord.user_id.full_name,
        toName: USER_TYPE.PANEL,
      });

      _Notification2.save();

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
    } else {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR_RATE,
            MESSAGE_STRING_ENGLISH.ERROR_RATE
          )
        );
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// add Rate of Orders and products
exports.addRateFromProviderToUser = async (req, reply) => {
  try {
    const ord = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token");

    if (ord.StatusId == 4) {
      let Rates = new Rate({
        order_id: ord._id,
        user_id: ord.user_id,
        employee_id: ord.employee_id,
        supplier_id: ord.supplier_id,
        rate_from_provider_to_user: req.body.rate_from_provider_to_user,
        note_from_provider_to_user: req.body.note_from_provider_to_user,
        createAt: getCurrentDateTime(),
        type: 2,
      });

      let rs = await Rates.save();
      const response = {
        status_code: 200,
        status: true,
        messageAr: "تم اضافة تقييمك بنجاح",
        messageEn: "Rate added sucessfully",
        items: rs,
      };

      // var msg = `قام ${ord.employee.full_name} بتقييم الطلب رقم: ${ord.Order_no}`;
      // CreateNotification(
      //   ord.employee_id.fcmToken,
      //   msg,
      //   ord._id,
      //   ord.employee_id._id,
      //   ord.user_id._id,
      //   ord.employee_id.full_name,
      //   ord.user_id.full_name
      // );

      reply.code(200).send(response);
    } else {
      const response = {
        status_code: 400,
        status: false,
        messageAr: "عذرا .. لا يمكن التقييم حتى الانتهاء من الخدمة",
        messageEn: "Sorry .. you can't rate righ now",
        items: {},
      };

      reply.code(200).send(response);
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateRate = async (req, reply) => {
  try {
    await Order.findByIdAndUpdate(
      req.params.id,
      {
        isOpen: true,
      },
      { new: true }
    );
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: null,
    };
    reply.send(response);
  } catch {
    throw boom.boomify(err);
  }
};

exports.getNewRatedOrder = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    const total = await Order.find({
      $and: [{ isRate: true }, { isOpen: false }],
    }).countDocuments();
    reply.send(total);
  } catch {
    throw boom.boomify(err);
  }
};

exports.getOrdersSearchFilter = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;

    let query1 = {};
    var page = parseFloat(req.body.page, 10);
    var limit = parseFloat(req.body.limit, 10);

    const place_id = req.headers["place"];
    const supplier_id = req.headers["supplier"];

    if (req.body.address && req.body.address != "") {
      query1["address"] = { $regex: new RegExp(req.body.address, "i") };
    }

    if (req.body.Order_no && req.body.Order_no != "") {
      query1["Order_no"] = req.body.Order_no;
    }

    if (req.body.StatusId && req.body.StatusId != "") {
      query1["StatusId"] = req.body.StatusId;
    }

    query1["place_id"] = place_id;
    query1["StatusId"] = supplier_id;

    const total = await Order.find(query1).countDocuments();
    const item = await Order.find(query1)
      .sort({ _id: -1 })
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate("user_id", "-token")
      .populate({
        path: "items.product_id",
        populate: { path: "product_id" },
      })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 })
      .select("-couponCode");
    var arr = [];
    item.forEach((element) => {
      let obj = {
        _id: element._id,
        Order_no: element.Order_no,
        Total: element.Total,
        StatusId: element.StatusId,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        OrderType: element.OrderType,
        supplier_id: element.supplier_id,
        client_name: element.user_id.full_name ? element.user_id.full_name : "",
        client_phone: element.user_id.phone_number
          ? element.user_id.phone_number
          : "",
      };
      arr.push(obj);
    });
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        arr,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getNearstSupplierByPlace = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    //for test 24.693601, 46.66594
    const place_id = req.headers["place"];
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    const raduis = 1000;
    var keys_arr = [];
    var employeesInPlace = await employee.find({
      $and: [{ place_id: place_id }, { isAvailable: true },{ isDeleted: false }],
    });
    let geoQuery = geoFire.query({
      center: [Number(lat), Number(lng)],
      radius: raduis,
    });

    var onKeyEnteredRegistration = geoQuery.on(
      "key_entered",
      async function (key, location, distance) {
        console.log(
          key + " Key " + location + " (" + distance + " km from center)"
        );
        var employees = employeesInPlace.map((x) => String(x._id));
        if (employees.includes(key)) {
          let obj = {
            key: key,
            location: location,
            distance: distance,
          };

          if (distance <= raduis) {
            keys_arr.push(obj);
          }
        }

        keys_arr.sort(function (a, b) {
          return a.distance > b.distance;
        });
      }
    );

    var onKeyExitedRegistration = geoQuery.on(
      "ready",
      async function (key, location, distance) {
        console.log(
          key + " Key " + location + " (" + distance + " km from center)"
        );
        onKeyEnteredRegistration.cancel();
        var ids = keys_arr.map((x) => x.key);
        console.log("ids: " + ids[0]);
        if (keys_arr.length > 0) {
          await employee.find(
            { $and: [{ _id: ids[0] },{ isDeleted: false }] },
            async function (err, _users) {
              var supplier_id = _users[0].supplier_id;
              reply
                .code(200)
                .send(
                  success(
                    language,
                    200,
                    MESSAGE_STRING_ARABIC.SUCCESS,
                    MESSAGE_STRING_ENGLISH.SUCCESS,
                    supplier_id
                  )
                );
              return;
            }
          );
        } else {
          var suppliers = await Place_Delivery.findOne({
            place_id: place_id,
          });
          if (suppliers) {
            var supplier_id = suppliers.supplier_id;
            reply
              .code(200)
              .send(
                success(
                  language,
                  200,
                  MESSAGE_STRING_ARABIC.SUCCESS,
                  MESSAGE_STRING_ENGLISH.SUCCESS,
                  supplier_id
                )
              );
            return;
          } else {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.NOT_COVERED,
                  MESSAGE_STRING_ENGLISH.NOT_COVERED,
                  ""
                )
              );
            return;
          }
        }
      }
    );

    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.checkDestinationInOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const place_id = req.headers["place"];
    // var supplier_id = req.headers["supplier"];
    var supplier_id = "";
    var newPlaceId = "";
    var lat = 0.0;
    var lng = 0.0;
    const raduis = 1000;
    var arr = [];
    if (
      String(req.body.is_address_book) == "true" &&
      req.body.address_book &&
      req.body.address_book != ""
    ) {
      var newAddress = await User_Address.findById(req.body.address_book);
      if (newAddress) {
        lat = Number(newAddress.lat);
        lng = Number(newAddress.lng);
      } else {
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
    } else {
      lat = Number(req.body.lat);
      lng = Number(req.body.lng);
    }
    if (lat != 0.0 && lng != 0.0) {
      // user delivery address in change
      var PoinInPolygon = await place.find({
        $and: [
          {
            loc: {
              $geoIntersects: {
                $geometry: {
                  type: "Point",
                  coordinates: [lng, lat],
                },
              },
            },
          },
          { isDeleted: false },
        ],
      });
      if (PoinInPolygon.length > 0) {
        var employeesInPlace = await employee.find({
          $and: [{ place_id: place_id }, { isAvailable: true },{ isDeleted: false }],
        });

        if (place_id == PoinInPolygon[0]._id) {
          newPlaceId = PoinInPolygon[0]._id;
          // same location don't doing anything .. and get nearest driver in same place and supplier
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
        } else {
          // change prices to new distination send it with new alert and new prices
          newPlaceId = PoinInPolygon[0]._id;
          employeesInPlace = await employee.find({
            $and: [{ place_id: newPlaceId }, { isAvailable: true },{ isDeleted: false }],
          });
          //get nearset supplier id in new place id
          var keys_arr = [];
          let geoQuery = geoFire.query({
            center: [Number(lat), Number(lng)],
            radius: raduis,
          });
          var onKeyEnteredRegistration = geoQuery.on(
            "key_entered",
            function (key, location, distance) {
              console.log(
                key + " Key " + location + " (" + distance + " km from center)"
              );
              var employees = employeesInPlace.map((x) => String(x._id));
              if (employees.includes(key)) {
                let obj = {
                  key: key,
                  location: location,
                  distance: distance,
                };

                if (distance <= raduis) {
                  keys_arr.push(obj);
                }
              }
              keys_arr.sort(function (a, b) {
                return a.distance > b.distance;
              });
            }
          );
          var onKeyExitedRegistration = geoQuery.on(
            "ready",
            async function (key, location, distance) {
              console.log(
                key + " Key " + location + " (" + distance + " km from center)"
              );
              onKeyEnteredRegistration.cancel();
              keys_arr.sort(function (a, b) {
                return a.distance > b.distance;
              });
              console.log(keys_arr);
              var ids = keys_arr.map((x) => x.key);
              if (keys_arr.length > 0) {
                await employee.find(
                  { $and: [{ _id: ids[0] },{ isDeleted: false }] },
                  async function (err, _users) {
                    supplier_id = _users[0].supplier_id;
                  }
                );
              } else {
                var suppliers = await Place_Delivery.findOne({
                  place_id: newPlaceId,
                });
                // var supplier_id = "";
                if (suppliers) {
                  supplier_id = suppliers.supplier_id;
                } else {
                  reply
                    .code(200)
                    .send(
                      errorAPI(
                        language,
                        400,
                        MESSAGE_STRING_ARABIC.NOT_COVERED,
                        MESSAGE_STRING_ENGLISH.NOT_COVERED
                      )
                    );
                  return;
                }
              }

              if (!req.body.items) {
                let cart = await Cart.find({
                  $and: [{ user_id: req.user._id }],
                });

                arr = await getCartObject(
                  newPlaceId,
                  supplier_id,
                  cart,
                  req.user._id,
                  req.body.isExpress,
                  language
                );
              } else {
                let item = req.body.items;
                arr = await getReplacmentObject(
                  newPlaceId,
                  supplier_id,
                  item,
                  req.user._id,
                  req.body.isExpress,
                  language
                );
              }
              var statusCode = 300;
              var msg_ar = "";
              var msg_en = "";
              if (arr && arr.products.length == 0) {
                statusCode = 320;
                msg_ar =
                  MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER;
                msg_en =
                  MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER;
              } else {
                statusCode = statusCode;
                msg_ar = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
                msg_en =
                  MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OCHANGE_PLACE_OR_SUPPLIERR_SUPPLIER_CHECK_ORDER;
              }
              reply
                .code(200)
                .send(success(language, statusCode, msg_ar, msg_en, arr));
              return;
            }
          );
        }
      } else {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.NOT_COVERED,
              MESSAGE_STRING_ENGLISH.NOT_COVERED
            )
          );
        return;
      }
    } else {
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
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

async function getCartObject(place_id, supplier_id, item, user_id, isExpress,language) {
  var language = language;
  var place_id = place_id;
  var supplier_id = supplier_id;
  const tax = await setting.findOne({ code: "TAX" });

  var providerArr = [];
  var totalPrice = 0.0;
  var totalDiscount = 0.0;
  var deliverycost = 0.0;

  for await (const data of item) {
    var ProviderArrIndex = _.findIndex(providerArr, function (_item) {
      return String(_item._id) == String(data.supplier_id);
    });
    if (ProviderArrIndex >= 0) {
      //exsits
      if (data.product_id && data.product_id != "" && data.product_id != 0) {
        var product = await Product.findOne({
          $and: [{ _id: data.product_id }, { isDeleted: false }],
        }).populate("category_id");
        if (product) {
          var productObject = product.toObject();

          var Product_Price_Object = await Product_Price.findOne({
            $and: [
              { place_id: place_id },
              { product_id: data.product_id },
              { supplier_id: supplier_id },
              { isDeleted: false },
            ],
          });
          if (Product_Price_Object) {
            const checkFavorite = await Favorite.findOne({
              $and: [{ user_id: user_id }, { product_id: data.product_id }],
            });
            if (checkFavorite) {
              productObject.favorite_id = checkFavorite._id;
            } else {
              productObject.favorite_id = null;
            }

            var cateogory = {
              _id: productObject.category_id._id,
              name: productObject.category_id[`${language}Name`],
              image: productObject.category_id.image
                ? productObject.category_id.image
                : "",
            };
            productObject.category_id = cateogory;
            productObject.discountPrice = Product_Price_Object.discountPrice;
            productObject.discountPriceReplacement =
              Product_Price_Object.discountPriceReplacement;
            productObject.price_for_new = Product_Price_Object.price_for_new;
            productObject.price_for_replacment =
              Product_Price_Object.price_for_replacment;

            delete productObject.arName;
            delete productObject.enName;
            delete productObject.arDescription;
            delete productObject.enDescription;
            productObject.name = product[`${language}Name`];
            productObject.description = product[`${language}Description`];

            productObject.cart_id = data._id;
            productObject.qty = Number(data.qty);
            if (
              Product_Price_Object.discountPrice &&
              Product_Price_Object.discountPrice != 0
            ) {
              productObject.Total = Number(
                Product_Price_Object.price_for_new * data.qty
              );
              productObject.TotalDiscount = Number(
                Product_Price_Object.discountPrice * data.qty
              );
            } else {
              productObject.Total = Number(
                Product_Price_Object.price_for_new * data.qty
              );
              productObject.TotalDiscount = 0;
            }

            // productObject.Total = Number(data.Total);
            // productObject.TotalDiscount = Number(data.TotalDiscount);

            providerArr[ProviderArrIndex].products.push(productObject);
          }
        }
      }
    } else {
      // new
      var provider_data = await Supplier.findOne({
        $and: [
          { _id: data.supplier_id },
          { isDeleted: false },
          { isBlock: false },
        ],
      }).select(["-token", "-password", "-cities"]);

      if (provider_data) {
        providerobject = provider_data.toObject();
        providerobject.products = [];

        if (data.product_id && data.product_id != "" && data.product_id != 0) {
          var _product = await Product.findOne({
            $and: [{ _id: data.product_id }, { isDeleted: false }],
          }).populate("category_id");
          if (_product) {
            var productObject = _product.toObject();

            var Product_Price_Object = await Product_Price.findOne({
              $and: [
                { place_id: place_id },
                { product_id: data.product_id },
                { supplier_id: supplier_id },
                { isDeleted: false },
              ],
            });
            if (Product_Price_Object) {
              const checkFavorite = await Favorite.findOne({
                $and: [{ user_id: user_id }, { product_id: data.product_id }],
              });
              if (checkFavorite) {
                productObject.favorite_id = checkFavorite._id;
              } else {
                productObject.favorite_id = null;
              }

              var cateogory = {
                _id: productObject.category_id._id,
                name: productObject.category_id[`${language}Name`],
                image: productObject.category_id.image
                  ? productObject.category_id.image
                  : "",
              };
              productObject.category_id = cateogory;
              productObject.discountPrice = Product_Price_Object.discountPrice;
              productObject.discountPriceReplacement =
                Product_Price_Object.discountPriceReplacement;
              productObject.price_for_new = Product_Price_Object.price_for_new;
              productObject.price_for_replacment =
                Product_Price_Object.price_for_replacment;

              delete productObject.arName;
              delete productObject.enName;
              delete productObject.arDescription;
              delete productObject.enDescription;
              productObject.name = _product[`${language}Name`];
              productObject.description = _product[`${language}Description`];
              productObject.cart_id = data._id;
              productObject.qty = Number(data.qty);
              if (
                Product_Price_Object.discountPrice &&
                Product_Price_Object.discountPrice != 0
              ) {
                productObject.Total = Number(
                  Product_Price_Object.price_for_new * data.qty
                );
                productObject.TotalDiscount = Number(
                  Product_Price_Object.discountPrice * data.qty
                );
              } else {
                productObject.Total = Number(
                  Product_Price_Object.price_for_new * data.qty
                );
                productObject.TotalDiscount = 0;
              }

              // productObject.TotalDiscount = Number(data.TotalDiscount);

              providerobject.products.push(productObject);
              providerArr.push(providerobject);
            }
          }
        }
      }
    }

    // totalPrice += data.Total;
    // totalDiscount += data.TotalDiscount;
    if (Product_Price_Object) {
      if (
        Product_Price_Object.discountPrice &&
        Product_Price_Object.discountPrice != 0
      ) {
        totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
        totalDiscount += Number(Product_Price_Object.discountPrice * data.qty);
      } else {
        totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
      }

      if(String(isExpress) == "true"){
        deliverycost += Number(Product_Price_Object.expressCost) * Number(data.qty);
      }else{
        deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
      }

    }
  }

  var sub_total = totalPrice - totalDiscount;
  var final_total = Number(sub_total * Number(tax.value)) + Number(sub_total) + Number(deliverycost);

  var returnObject = {
    products: providerArr,
    new_supplier_id: supplier_id,
    new_place_id: place_id,
    tax: (Number(sub_total + deliverycost) * Number(tax.value)),
    deliveryCost: Number(deliverycost),
    total_price: Number(parseFloat(totalPrice).toFixed(2)),
    total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
    final_total: Number(parseFloat(final_total).toFixed(2)),
  };

  return returnObject;
}

async function getReplacmentObject(
  place_id,
  supplier_id,
  item,
  user_id,
  isExpress,
  _language
) {
  const language = _language;
  var place_id = place_id;
  var supplier_id = supplier_id;
  var products = [];
  const tax = await setting.findOne({ code: "TAX" });

  var totalPrice = 0.0;
  var totalDiscount = 0.0;
  var deliverycost = 0.0;

  var cart_arr = item;
  for await (const data of cart_arr) {
    var Product_Price_Object = await Product_Price.findOne({
      $and: [
        { place_id: place_id },
        { supplier_id: supplier_id },
        { product_id: data.product_id },
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

      if (
        Product_Price_Object.discountPriceReplacment &&
        Product_Price_Object.discountPriceReplacment != 0
      ) {
        totalPrice +=
          Number(Product_Price_Object.price_for_replacment) * data.qty;
        totalDiscount += Number(
          Product_Price_Object.discountPriceReplacment * data.qty
        );
      } else {
        totalPrice +=
          Number(Product_Price_Object.price_for_replacment) * data.qty;
      }

      if(String(isExpress) == "true"){
        deliverycost += Number(Product_Price_Object.expressCost) * Number(data.qty);
      }else{
        deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
      }


      var newProduct = await Product.findById(data.product_id)
        .populate("category_id")
        .sort({ _id: -1 });

      const newObj = newProduct.toObject();

      const checkFavorite = await Favorite.findOne({
        $and: [{ user_id: user_id }, { product_id: newProduct._id }],
      });

      if (checkFavorite) {
        newObj.favorite_id = checkFavorite._id;
      } else {
        newObj.favorite_id = null;
      }

      var cateogory = {
        _id: newProduct.category_id._id,
        name: newProduct.category_id[`${language}Name`],
        image: newProduct.category_id.image ? newProduct.category_id.image : "",
      };

      delete newObj.arName;
      delete newObj.enName;
      delete newObj.arDescription;
      delete newObj.enDescription;
      newObj.discountPriceReplacment =
        Product_Price_Object.discountPriceReplacment;
      newObj.discountPrice = Product_Price_Object.discountPrice;
      newObj.price_for_new = Product_Price_Object.price_for_new;
      newObj.price_for_replacment = Product_Price_Object.price_for_replacment;
      newObj.name = newProduct[`${language}Name`];
      newObj.description = newProduct[`${language}Description`];
      newObj.category_id = cateogory;
      newObj.qty = Number(data.qty);
      if (
        Product_Price_Object.discountPriceReplacment &&
        Product_Price_Object.discountPriceReplacment != 0
      ) {
        newObj.Total = Number(
          Product_Price_Object.price_for_replacment * data.qty
        );
        newObj.TotalDiscount = Number(
          Product_Price_Object.discountPriceReplacment * data.qty
        );
      } else {
        newObj.Total = Number(
          Product_Price_Object.price_for_replacment * data.qty
        );
        newObj.TotalDiscount = 0;
      }

      products.push(newObj);
    }
  }

  var sub_total = totalPrice - totalDiscount;
  var final_total = Number(sub_total * Number(tax.value)) + Number(sub_total) + Number(deliverycost);

  var returnObject = {
    products: products,
    new_supplier_id: supplier_id,
    new_place_id: place_id,
    tax: (Number(sub_total + deliverycost) * Number(tax.value)),
    deliveryCost: Number(deliverycost),
    total_price: Number(parseFloat(totalPrice).toFixed(2)),
    total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
    final_total: Number(parseFloat(final_total).toFixed(2)),
  };

  return returnObject;
}

////////////Admin/////////////
exports.getUserOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    const total = await Order.find({ user_id: userId }).countDocuments();
    const item = await Order.find({ user_id: userId })
      .sort({ _id: -1 })
      .populate("place_id")
      .populate("supplier_id", "-token")
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getProivdeOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    const total = await Order.find({ supplier_id: userId }).countDocuments();
    const item = await Order.find({ supplier_id: userId })
      .sort({ _id: -1 })
      .populate("place_id")
      .populate("supplier_id", "-token")
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getEmployeesOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var result = [];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);


    const total = await Order.find({ employee_id: userId }).countDocuments();
    const item = await Order.find({ employee_id: userId })
      .sort({ _id: -1 })
      .populate("place_id")
      .populate("supplier_id", "-token")
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "items.product_id",
        populate: { path: "product_id" },
      })
      .populate({
        path: "items.product_id",
        populate: {
          path: "category_id",
        },
      })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrders = async (req, reply) => {
  const language = "ar";
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {};
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: new Date(new Date(req.body.dt_from).setHours(00, 00, 00)),
          $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
        },
      };
    }

    if (req.body.provider_id && req.body.provider_id != "")
      query["supplier_id"] = req.body.provider_id;

    if (req.body.statusId && req.body.statusId != ""){
      if(req.body.statusId == -1 || req.body.statusId == 1){
        query["StatusId"] = {$in:[1,-1]}
      }else{
        query["StatusId"] = req.body.statusId;
      }
    }
    if (req.body.Order_no && req.body.Order_no != "")
      query["Order_no"] = req.body.Order_no;

    const total = await Order.find(query).countDocuments();

    const _paymentLogAll = await Order.find(query);
    let Admin_Total = lodash.sumBy(_paymentLogAll, function (o) {
      return o.Admin_Total;
    });
    let provider_Total = lodash.sumBy(_paymentLogAll, function (o) {
      return o.provider_Total;
    });
    let Total = lodash.sumBy(_paymentLogAll, function (o) {
      return o.Total;
    });

    var item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("supplier_id", ["-token", "-password"])
      .populate("place_id")
      .populate("user_id", ["-token", "-password"])
      .populate("employee_id", ["-token", "-password"])
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .skip(page * limit)
      .limit(limit)
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
      Admin_Total: Admin_Total,
      provider_Total: provider_Total,
      Total: Total,
      pagination: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateOrder = async (req, reply) => {
  const language = "ar";
  try {
    const orderDetails = await Order.findById(req.params.id);
    if (!orderDetails) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR,
            MESSAGE_STRING_ARABIC.ERROR,
            {}
          )
        );
      return;
    }
    if (orderDetails.StatusId == 5) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.CANCEL_ORDER_FAILED2,
            MESSAGE_STRING_ARABIC.CANCEL_ORDER_FAILED2,
            {}
          )
        );
      return;
    }
    var notes = "";
    if (req.body.notes && req.body.notes != "") {
      notes = req.body.notes;
    }
    var sp = {};
    var msg = "";
    if (req.body.statusId == 2) {
      //approve

      sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.statusId,
          employee_id: req.body.employee_id,
        },
        { new: true }
      )
        .populate("provider_id", ["-token", "-password"])
        .populate("user_id", ["-token", "-password"]);
      msg = "تم قبول طلبكم رقم " + sp.Order_no + " وجاري التنفيذ ";

      CreateGeneralNotification(
        sp.user_id ? sp.user_id.fcmToken : "",
        "الطلبات",
        msg,
        1,
        sp._id,
        USER_TYPE.PANEL,
        sp.user_id._id,
        USER_TYPE.PANEL,
        sp.user_id.full_name
      );

      CreateGeneralNotification(
        sp.employee_id ? sp.employee_id.fcmToken : "",
        "طلب جديد",
        msg,
        1,
        sp._id,
        USER_TYPE.PANEL,
        sp.employee_id._id,
        USER_TYPE.PANEL,
        sp.employee_id.full_name
      );
    }
    // if (req.body.statusId == 3) {
    //   //process
    //   msg = " جاري توصيل طلبكم رقم " + sp.Order_no;
    // }
    // if (req.body.statusId == 4) {
    //   //deliverd
    //   msg = " تم توصيل طلبكم رقم " + sp.Order_no;
    // }
    if (req.body.statusId == 5) {
      //cancel
      msg =
        " عذرا .. تم الغاء طلبكم رقم " + sp.Order_no + " وذلك بسبب " + notes;

      sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.statusId,
          notes: req.body.notes,
        },
        { new: true }
      )
        .populate("provider_id", ["-token", "-password"])
        .populate("user_id", ["-token", "-password"]);

      CreateGeneralNotification(
        sp.user_id ? sp.user_id.fcmToken : "",
        "الطلبات",
        msg,
        1,
        sp._id,
        USER_TYPE.PANEL,
        sp.user_id._id,
        USER_TYPE.PANEL,
        sp.user_id.full_name
      );
    }

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ARABIC.SUCCESS,
          sp
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteRate = async (req, reply) => {
  const language = "ar";
  try {
    const rate = await Rate.findByIdAndRemove(req.params.id);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: [],
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getOrdersRateList = async (req, reply) => {
  const language = "ar";
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {};
    var newItens = [];
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: new Date(new Date(req.body.dt_from).setHours(00, 00, 00)),
          $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
        },
      };
    }
    if (req.body.provider_id != "") query["supplier_id"] = req.body.provider_id;

    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .populate("order_id")
      .populate("user_id", ["-password", "-token"])
      .populate("supplier_id", ["-password", "-token"])
      .populate("employee_id", ["-password", "-token"])
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    var rateArray = [];
    for await (const data of item) {
      var newObject = data.toObject();
      const ord = await Order.findById(data.destination_id);
      if (ord) newObject.order_no = ord.Order_no;
      rateArray.push(newObject);
    }

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        rateArray,
        {
          size: rateArray.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getProivderRate = async (req, reply) => {
  const language = "ar";
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    query["destination_id"] = String(req.query.destination_id);
    query["type"] = 2;
    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .populate("user_id", ["-password", "-token"])
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    var rateArray = [];
    item.forEach((element) => {
      var obj = customRate(element);
      rateArray.push(obj);
    });

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        rateArray,
        {
          size: rateArray.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrdersMap = async (req, reply) => {
  try {
    let searchDate = moment()
      .add(-6, "months")
      .startOf("day")
      .tz("Asia/Riyadh");

      var query = {}
      query["dt_date"]= { $gte: searchDate } 
      if(req.query.status_id == -1 || req.query.status_id == 1){
        query["StatusId"] = {$in:[1,-1]}
      }else{
        query["StatusId"] = req.query.status_id;
      }
      

    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .sort({ _id: -1 });
    // .limit(2000)
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: item,
    };
    reply.send(response);
  } catch {
    throw boom.boomify(err);
  }
};
