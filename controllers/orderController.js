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
const { Order, Rate, Payment, Transactions } = require("../models/Order");
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
  ORDER_STATUS,
  PASSENGER_STATUS,
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
  NewPayment,
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const { string, number } = require("@hapi/joi");
const { employee } = require("../models/Employee");
const { Firebase } = require("../utils/firebase");
const e = require("cors");
var database = Firebase.database();
var geoFire = new GeoFire(database.ref("userLocation"));
var language = "ar"

exports.addOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var validationArray = [
        { name: "couponCode" },
        { name: "paymentType" },
        { name: "dt_date" },
        { name: "dt_time" },
      ];

      validationArray.push({ name: "f_lat" });
      validationArray.push({ name: "f_lng" });
      validationArray.push({ name: "t_lng" });
      validationArray.push({ name: "t_lng" });
    
      check_request_params(req.body, validationArray, async function (response) {
        if (response.success) {
          var userId = req.user._id;
          const userObj = await Users.findById(userId);
          const tax = await setting.findOne({ code: "TAX" });
          const raduis = await setting.findOne({ code: "RADUIS" });

          var ar_msg = MESSAGE_STRING_ARABIC.SUCCESSNEW;
          var en_msg = MESSAGE_STRING_ENGLISH.SUCCESSNEW;
          var statusCode = 200;
          var orderNo = `${makeOrderNumber(6)}`;

          
          if(req.body.orderType == 2 && Number(req.body.price) > Number(userObj.walllet)){
            reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.WALLET,
                MESSAGE_STRING_ENGLISH.WALLET,
                {}
              )
            );
          return;
          }
          let Orders = new Order({
            title: req.body.title,
            f_lat: req.body.f_lat,
            f_lng: req.body.f_lng,
            t_lat: req.body.t_lat,
            t_lng: req.body.t_lat,
            max_price: req.body.max_price,
            min_price: req.body.min_price,
            price: 0,
            f_address: req.body.f_address,
            t_address: req.body.t_address,
            order_no: orderNo,
            tax: Number( tax.value ),
            totalDiscount: 0,
            netTotal: 0,
            status: ORDER_STATUS.new,
            createAt: getCurrentDateTime(),
            dt_date: req.body.dt_date,
            dt_time: req.body.dt_time,
            is_repeated: req.body.is_repeated,
            days: req.body.days,
            couponCode: "",
            paymentType: req.body.paymentType,
            orderType: req.body.orderType,
            max_passenger: req.body.max_passenger,
            passengers: [],
            offers: [],
            user: userId,
            notes: req.body.notes,
            canceled_note:"",
            coordinates: [req.body.f_lat, req.body.f_lng]
          });

          let geoQuery = geoFire.query({
            center: [Number(req.body.f_lat), Number(req.body.f_lng)],
            radius: Number(raduis.value),
          });

          let rs = await Orders.save();
          let msg = "لديك طلب جديد";
          var notifications_arr = []
          var keys_arr = [];

          //search for firebase for near by users and send notification for them
          var onKeyEnteredRegistration = geoQuery.on("key_entered", async function (key, location, distance) {
              console.log("first")
              console.log( key + " Key " + location + " (" + distance + " km from center)" );
              var _employees = await Users.find({ hasCar: true })
              var employees = _employees.map((x) => String(x._id));
              
              if (employees.includes(key)) {
                let obj = {
                  key: key,
                  location: location,
                  distance: distance,
                };  
                console.log(distance)    
                console.log(Number(raduis.value))  
                console.log(distance <= Number(raduis.value))  
                if (distance <= Number(raduis.value)) {
                  keys_arr.push(obj);
                }
              }
              keys_arr.sort(function (a, b) { return a.distance > b.distance });
              var ids = keys_arr.map((x) => x.key);
              if (keys_arr.length > 0) {
                  var _users = []
                  if(req.body.orderType == 1){
                    _users =  await Users.find({ $and: [{ _id: { $in: ids } }, { isDeleted: false }, { hasCar: false }] });
                  }else{
                    _users =  await Users.find({ $and: [{ _id: { $in: ids } }, { isDeleted: false }, { hasCar: true }] });
                  }

                  console.log(keys_arr)
                  CreateNotificationMultiple(_users.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id);

                  _users.forEach(element => {
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

                  await Notifications.insertMany(notifications_arr, (err, _docs) => {
                    if (err) {
                      return console.error(err);
                    } else {
                      console.log("Multiple documents inserted to Collection");
                    }
                  });
                  onKeyEnteredRegistration.cancel();
                  reply
                    .code(200)
                    .send(
                      success(
                        language,
                        200,
                        MESSAGE_STRING_ARABIC.SUCCESS,
                        MESSAGE_STRING_ENGLISH.SUCCESS,
                        {_id: Orders._id}
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
                      {}
                    )
                  );
                return;
              }
            }
          );
      
          // var onKeyExitedRegistration = geoQuery.on("ready", async function (key, location, distance) {
          //     console.log("second")
          //     console.log(key + " Key " + location + " (" + distance + " km from center)");
          //     onKeyEnteredRegistration.cancel();
          //     console.log(keys_arr)
          //     var ids = keys_arr.map((x) => x.key);
          //     if (keys_arr.length > 0) {
          //         var _users = []
          //         if(req.body.orderType == 1){
          //           _users =  await Users.find({ $and: [{ _id: { $in: ids } }, { isDeleted: false }, { hasCar: false }] });
          //         }else{
          //           _users =  await Users.find({ $and: [{ _id: { $in: ids } }, { isDeleted: false }, { hasCar: true }] });
          //         }

          //         console.log(keys_arr)
          //         CreateNotificationMultiple(_users.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id);

          //         _users.forEach(element => {
          //           let _Notification2 = new Notifications({
          //             fromId: userId,
          //             user_id: element._id,
          //             title: NOTIFICATION_TITILES.ORDERS,
          //             msg: msg,
          //             dt_date: getCurrentDateTime(),
          //             type: NOTIFICATION_TYPE.ORDERS,
          //             body_parms: rs._id,
          //             isRead: false,
          //             fromName: userObj.full_name,
          //             toName: element.full_name,
          //           });
          //           notifications_arr.push(_Notification2)
          //         });

          //         await Notifications.insertMany(notifications_arr, (err, _docs) => {
          //           if (err) {
          //             return console.error(err);
          //           } else {
          //             console.log("Multiple documents inserted to Collection");
          //           }
          //         });

          //         reply
          //           .code(200)
          //           .send(
          //             success(
          //               language,
          //               200,
          //               MESSAGE_STRING_ARABIC.SUCCESS,
          //               MESSAGE_STRING_ENGLISH.SUCCESS,
          //               {_id: Orders._id}
          //             )
          //           );
          //         return;
                  
          //     } else {
          //       reply
          //         .code(200)
          //         .send(
          //           errorAPI(
          //             language,
          //             400,
          //             MESSAGE_STRING_ARABIC.NOT_COVERED,
          //             MESSAGE_STRING_ENGLISH.NOT_COVERED,
          //             {}
          //           )
          //         );
          //       return;
          //     }
          //   }
          // );
          
          // current_employee.forEach(element => {
          //   let _Notification2 = new Notifications({
          //     fromId: userId,
          //     user_id: element._id,
          //     title: NOTIFICATION_TITILES.ORDERS,
          //     msg: msg,
          //     dt_date: getCurrentDateTime(),
          //     type: NOTIFICATION_TYPE.ORDERS,
          //     body_parms: rs._id,
          //     isRead: false,
          //     fromName: userObj.full_name,
          //     toName: element.full_name,
          //   });
          //   notifications_arr.push(_Notification2)
          // });
          
          // CreateNotificationMultiple(current_employee.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id)
          
          // await Notifications.insertMany(notifications_arr, (err, _docs) => {
          //   if (err) {
          //     return console.error(err);
          //   } else {
          //     console.log("Multiple documents inserted to Collection");
          //   }
          // });

          //reply.code(200).send(success(language, statusCode, ar_msg, en_msg, {}));
          
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

exports.addOffer = async (req, reply) => {
  try {
    let userId = req.user._id
    const checkOrder = await Order.findById(req.params.id);
    let _userObj = await Users.findById(userId);

    if(!checkOrder) {
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

    let userIds = checkOrder.offers.map(x=>String(x.user))
    if(userIds.includes(String(userId))){
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT
        )
      );
    return;
    }else{ 
      if(checkOrder.status != ORDER_STATUS.new){
          reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.OFFER_ERROR,
              MESSAGE_STRING_ENGLISH.OFFER_ERROR
            )
          );
          return;
      }
              
      if(req.body.orderType == 1 && Number(req.body.price) > Number(_userObj.walllet)){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.WALLET,
            MESSAGE_STRING_ENGLISH.WALLET,
            {}
          )
        );
      return;
      }

      if(req.body.orderType == 2 && _userObj.hasCar != true){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.NOCAR,
            MESSAGE_STRING_ENGLISH.NOCAR,
            {}
          )
        );
      return;
      }

      if( Number(req.body.price) >= Number(checkOrder.min_price) && Number(req.body.price)<= Number(checkOrder.max_price)){
       let offer = {
        user:      userId,
        f_address: req.body.f_address,
        t_address: req.body.t_address,
        f_lat:     req.body.f_lat,
        f_lng:     req.body.f_lng,
        t_lat:     req.body.t_lat,
        t_lng:     req.body.t_lng,
        price:     Number(req.body.price),
        notes:     req.body.notes,
        status:    PASSENGER_STATUS.add_offer,
        dt_date:   req.body.dt_date,
        dt_time:   req.body.dt_time,
      }
      const sp = await Order.findByIdAndUpdate(
          req.params.id,
          {
            $push: { offers: offer } ,
          },
          { new: true }
       )

        var msg = `تم اضافة عرض عبى طلبك`;
        var msg2 = `تم قبول طلبك بنجاح`;
    
        let userObj = await Users.findById(sp.user);
        CreateGeneralNotification(
          userObj.fcmToken,
          NOTIFICATION_TITILES.ORDERS,
          msg,
          NOTIFICATION_TYPE.ORDERS,
          sp._id,
          userId,
          userObj._id,
          "",
          userObj.full_name
        );

        reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.SUCCESS,
            MESSAGE_STRING_ENGLISH.SUCCESS,
            {}
          )
        );
      }else{
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR_PRICE,
            MESSAGE_STRING_ENGLISH.ERROR_PRICE
          )
        );
      return;
      }
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOffer = async (req, reply) => {
  try {
      let userId = req.user._id
      const sp = await Order.findOneAndUpdate(
         {
            $and:[
              {_id: req.params.id}, 
              { offers: { $elemMatch: { _id: req.body.offer} }}
            ]
         },
         {
          $set: {
            "offers.$.status": req.body.status
          }
         },
         { new: true }
      )

      // var msg = `تم اضافة طلب جديد اليك`;
      var msg = ""
      var msg_accpet = `تم قبول عرضك على الطلب بنجاح`;
      var msg_reject = `تم رفض عرضك على الطلب`;
      // var msg_attend = `تم حضور الزبون بنجاح`;
      // var msg_not_attend = `بم يتم حضور الزبون `;
      
      if(req.body.status == PASSENGER_STATUS.accept_offer){
        msg = msg_accpet;
        if(sp.orderType != 1){
          await Order.findByIdAndUpdate(sp._id, { status: ORDER_STATUS.accpeted }, { new: true } )
        }
      }
      if(req.body.status == PASSENGER_STATUS.reject_offer){
        msg = msg_reject;
      }

      // if(req.body.status == 'attend'){
      //   msg = msg_attend;
      // }
      // if(req.body.status == 'not_attend'){
      //   msg = msg_not_attend;
      // }

      var to_userId = sp.offers.find(x=>x._id == req.body.offer)
      var userObj = await Users.findById(to_userId.user)
      
      CreateGeneralNotification(
        userObj.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        userId,
        userObj._id,
        "",
        ""
      );
  
      reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          {}
        )
      );
    
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOrder = async (req, reply) => {
  try {
    let userId = req.user._id

    const sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          status: req.body.status,
          canceled_note: req.body.canceled_note
        },
        { new: true }
      )

      var msg = ""
      var msg_started = `تم قبول عرضك على الطلب بنجاح`;
      var msg_finished = `تم رفض عرضك على الطلب`;
      var msg_canceled_by_driver = `تم حضور الزبون بنجاح`;
      var msg_canceled_by_user = `بم يتم حضور الزبون `;
      
      if(req.body.status == ORDER_STATUS.started) {
        msg = msg_started;
      }
      if(req.body.status == ORDER_STATUS.finished) {
        msg = msg_finished;
        if(sp.orderType == 1) {
          let use = await Users.findById(sp.user);
          let offers_users = sp.offers.filter(x=>x.status == PASSENGER_STATUS.accept_offer);
          if(offers_users.length > 0) {
            for await (const i of offers_users){
              await NewPayment(use._id, `اكمال طلب ${sp.title}`, '+', i.price, 'Online');
              await NewPayment(i.user, `اكمال طلب ${sp.title}`, '-', i.price, 'Online');
            }
          }
        }else {
         let use = await Users.findById(sp.user);
         let offers_users = sp.offers.filter(x=>x.status == PASSENGER_STATUS.accept_offer);
         if(offers_users.length > 0) {
          await NewPayment(use._id, `اكمال طلب ${sp.title}`, '-', sp.price, 'Online');
          await NewPayment(offers_users[0].user, `اكمال طلب ${sp.title}`, '+', sp.price, 'Online');
         }
        }
      }
      
      if(req.body.status == ORDER_STATUS.canceled_by_driver){
        msg = msg_canceled_by_driver;
      }

      if(req.body.status == ORDER_STATUS.canceled_by_user){
        msg = msg_canceled_by_user;
      }
  
      if(sp.orderType == 1){
        var  _users10 = sp.offers.filter(x=>x.status == PASSENGER_STATUS.accept_offer)
        var _users = _users10.map(x=>x.user);

        if(_users.length > 0){
          var _userObjs = await Users.find({_id:{$in:_users}});
          for await(const i of _userObjs){
            await CreateGeneralNotification(
              i.fcmToken,
              NOTIFICATION_TITILES.ORDERS,
              msg,
              NOTIFICATION_TYPE.ORDERS,
              sp._id,
              userId,
              i._id,
              "",
              ""
            );
          }
        }
      }else {
        var  _users = sp.offers.filter(x=>x.status == PASSENGER_STATUS.accept_offer)
        if(_users.length > 0) {
          var _userObjs = await Users.find({ _id: { $in:_users } });
          var _userTo = await Users.find({ _id: sp._id });
          for await(const i of _userObjs) {
            await CreateGeneralNotification(
              i.fcmToken,
              NOTIFICATION_TITILES.ORDERS,
              msg,
              NOTIFICATION_TYPE.ORDERS,
              sp._id,
              i._id,
              _userTo._id,
              "",
              ""
            );
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
          {}
        )
      );
    
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getUserOrderMap = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;
    const raduis = await setting.findOne({ code: "RADUIS" });

    //search in raduis 
    var q = []
    if(req.query.address && req.query.address != ""){
      q = [
        { status: ORDER_STATUS.new },
        { "f_address": { "$regex": req.query.address, "$options": "i" } },
        {  
          location: {
            $near: {
              $maxDistance: Number(raduis.value),
              $geometry: {
                  type: "Point",
                  coordinates: [req.query.lat, req.query.lng]
                }
              }
          }
        }
      ]
    }else {
      q = [
        { status: ORDER_STATUS.new },
        {  
          location: {
            $near: {
              $maxDistance: Number(raduis.value),
              $geometry: {
                  type: "Point",
                  coordinates: [req.query.lat, req.query.lng]
                }
              }
          }
        }
      ]
    }
   
    const items = await Order.find(q)
    .sort({ _id: -1 })
    .populate("user", "-token")
    .populate({ path: "offers.user", populate: { path: "user" } })

    reply.code(200).send(
    success(
      language,
      200,
      MESSAGE_STRING_ARABIC.SUCCESS,
      MESSAGE_STRING_ENGLISH.SUCCESS,
      items,
      // {
      //   size: item.length,
      //   totalElements: total,
      //   totalPages: Math.floor(total / limit),
      //   pageNumber: page,
      // }
    )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getUserOrder = async (req, reply) => {
  try {
    const userId = req.user._id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    
    var query = {
      $and: [
        { 
          $or:[ { "offers.user": userId }, { user: userId } ] 
        }
      ]
    };

    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.new) {
      query.$and.push({ status: {$in:[ORDER_STATUS.new, ORDER_STATUS.started ]}})
    }
    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.finished) {
      query.$and.push({ status: ORDER_STATUS.finished })
    }
    if (req.query.status && req.query.status != "" && req.query.status.includes("canceled")) {
      query.$and.push({ $in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user] })
    }
    
    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "offers.user", populate: { path: "user" } })
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

exports.getOrderDetails = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var rate = await Rate.findOne({
      $and: [{ order_id: req.params.id }, { type: 1 }],
    });

    if (rate) {
      isRate = true;
    }

    var item = await Order.findById(req.params.id)
    .populate("user", "-token")
    .populate({ path: "offers.user", populate: { path: "user" } })
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

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          item
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addRateFromUserToEmployee = async (req, reply) => {
  try {
    let userId = req.user._id
    const ord = await Order.findById(req.params.id)
    var driver_id = ""
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
    if (ord.status == ORDER_STATUS.finished) {
      if(ord.orderType == 1){
        driver_id = ord.user
      }else{
        let offers = ord.offers.find(x=>String(x.status) === String(PASSENGER_STATUS.accept_offer))
        if(offers) {
          driver_id = offers.user
        }
      }
      var checkBefore = await Rate.findOne({ $and: [{ order_id: ord._id }, { driver_id: driver_id }, { type: 1 }] });

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

      if (!req.body.rate_from_user) {
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
        user_id: userId,
        driver_id: driver_id,
        rate_from_user: req.body.rate_from_user,
        note_from_user: req.body.note_from_user,
        createAt: getCurrentDateTime(),
        type: 1,
      });

      let rs = await Rates.save();
      var totalRates = await Rate.find({$and: [{ driver_id: driver_id }, { type: 1 }] }).countDocuments();
      var summation = await Rate.find({ $and: [{ driver_id: driver_id }, { type: 1 }] });
      let sum = lodash.sumBy(summation, function (o) { return o.rate_from_user; });

      let driver = await Users.findByIdAndUpdate(driver_id, { rate: Number(sum / totalRates).toFixed(1), });
      await Order.findByIdAndUpdate(ord._id, { status: ORDER_STATUS.rated });

      var msg = `تمت اضافة تقييم جديد على طلب رقم: ${ord.title}`;
      await CreateGeneralNotification(
        driver.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        ord._id,
        userId,
        driver_id,
        "",
        ""
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

exports.getTransaction = async (req, reply) => {
  try {
    const userId = req.user._id;

    var last_total = 0;
    var last_date = 0;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    
    const total = await Transactions.find({ user: userId }).countDocuments();
    const item = await Transactions.find({ user: userId })
    .sort({ _id: -1 })
    .populate("user", "-token")
    .skip(page * limit)
    .limit(limit);

    // let trans = new Transactions({
    //     order_no: "2030394",
    //     user: "5f590217ff72110024dd1686",
    //     total: 300,
    //     createAt: getCurrentDateTime(),
    //     paymentType: "Online",
    //     details: "شحن المحفظة",
    //   });
    //   await trans.save();

    const items = await Transactions.find({ user: userId }).sort({createAt:-1}).limit(1)
    if(item.length > 0 ) {
      last_date = items[0].createAt
    }
    items.forEach(element => {
      last_total += Number(element.total)
    });

    const response = {
      items: item,
      total: last_total,
      last_date: last_date,
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
          $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)),
          $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
        },
      };
    }

    if (req.body.status && req.body.status != ""){
      if(req.body.status == ORDER_STATUS.finished){
        query["status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}
      }
      else if(req.body.status == 'canceled' ){
        query["status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["status"] = req.body.status;
      }
    }
    if (req.body.order_no && req.body.order_no != "")
      query["order_no"] = req.body.order_no;

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", ["-token"])
      .populate({ path: "offers", populate: { path: "user" } })
      .skip(page * limit)
      .limit(limit)
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
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

exports.deleteRate = async (req, reply) => {
  const language = "ar";
  try {
    const rate = await Rate.findByIdAndRemove(req.params.id);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: {},
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
          $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)),
          $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
        },
      };
    }

    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
    .populate("order_id")
    .populate({
      path: 'order_id',
      populate: {
          path: 'offers', 
          populate: {
              path: 'user',
          }
      }
     })
    .populate("user_id", ["-password", "-token"])
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

    reply
      .code(200)
      .send(
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
      query["status"] = req.query.status_id;
      
      

    console.log(query)
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "offers.user", populate: { path: "user" } })
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
  } catch(err) {
    throw boom.boomify(err);
  }
};
