// External Dependancies
const boom = require("boom");
const jwt = require("jsonwebtoken");
const config = require("config");
const fs = require("fs");
const async = require("async");
const lodash = require("lodash");
const moment = require("moment-timezone");
const Joi = require("@hapi/joi");
const axios = require("axios");
const utils = require("../utils/utils");
const cron = require("node-cron");

// Get Data Models

const { Order } = require("../models/Order");
const {
  Users,
  User_Address,
  User_Uncovered,
  validateUsers,
  getErrors,
  setLanguage,
  Companies,
  WishGroup,
  Wish,
  Reminder,
  VIP,
  Product_Request,
  ProductRequest,
  Friend,
} = require("../models/User");
const {
  getCurrentDateTime,
  walletsettings,
  setting,
} = require("../models/Constant");
const { Adv } = require("../models/adv");
const { Notifications } = require("../models/Notifications");
const { emloyee } = require("../models/Employee");
const { Favorite } = require("../models/Favorite");
const {
  encryptPassword,
  mail_reset_password,
  makeid,
  uploadImages,
  CreateGeneralNotification,
  CreateNotification,
  sendSMS,
  getAddress,
  emailRegex,
  handleError,
  NewPayment,
  makeOrderNumber
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
  ORDER_STATUS,
  NOTIFICATION_TITILES,
  NOTIFICATION_TYPE,
} = require("../utils/constants");
const { coupon_usage } = require("../models/Coupon");
const { Product } = require("../models/Product");

exports.Reminders = async function PendingCronOrders() {
  cron.schedule(`0 9 * * *`, async () => {
    var cond = moment().tz("Asia/Riyadh").startOf('day').format(moment.HTML5_FMT.DATE);
    let orders = await Reminder.find({ date: { $gte: cond } }).populate('user_id');
    for await(const i of orders) {
      //.format(moment.HTML5_FMT.DATE);
      var today = moment().tz("Asia/Riyadh").startOf('day')
      var reminder = moment(i.date).tz("Asia/Riyadh").startOf('day');
      var reminder_date = today.add(Number(i.before), "days")
      console.log(reminder_date)
      console.log(reminder)
      var minutes = today.diff(reminder_date, "days");
      console.log(minutes)
      if(minutes == 0) {
          var msg = `عزيزي المشترك نود تذكيرك بمناسبتك: : ${i.title}`;
          await CreateGeneralNotification(i.user_id.fcmToken, NOTIFICATION_TITILES.REMINDER, msg, NOTIFICATION_TYPE.REMINDER, i._id, "", i.user_id._id, "", "");  
      }
    }
  });
};

// Get all Users
exports.getUsers = async (req, reply) => {
  // try {

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    let search_field = req.body.search_field;
    let search_value = req.body.search_value;
    let user_type = req.body.user_type;

    let query1 = {$and:[{search_field: { $regex: new RegExp(search_value, "i") }}]};
    if(user_type == "delete"){
      query1.$and.push({isBlock:true})
    }
    if(user_type == "active"){
      query1.$and.push({isBlock:false})
    }
    // query1[search_field] = { $regex: new RegExp(search_value, "i") };

    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query1["createAt"]= { $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)), $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)) }
    }

    const total = await Users.find(query1).countDocuments();
    const item = await Users.find(query1)
      .populate("city_id")
      .skip(page * limit)
      .limit(limit);

      for await (const i of item){
        var referal = await Users.find({by:i._id})
        console.log(referal)
        item.favorites = referal.length
      }

      const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  // } catch (err) {
  //   throw boom.boomify(err);
  // }
};

exports.getUsersExcel = async (req, reply) => {
  try {
    console.log(req.body);

    let search_field = req.body.search_field;
    let search_value = req.body.search_value;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    let user_type = req.body.user_type;

    let query1 = {};
    if(user_type == "delete"){
      query1['isBlock'] = true
    }
    if(user_type == "active"){
      query1['isBlock'] = false
    }
    query1[search_field] = { $regex: new RegExp(search_value, "i") };
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query1["createAt"]= { $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)), $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)) }
    }
    const total = await Users.find(query1).countDocuments();
    const item = await Users.find(query1).populate("city_id");
    console.log(item);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getSingleUsers = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;
    const _Users = await Users.findById(user_id).select();
    const address = await User_Address.find({$and: [{ user_id: user_id }],
    });
    var newUser = _Users.toObject();
    const orders = await Order.find({
      $and: [{ user_id: user_id }, { StatusId: 4 }],
    }).countDocuments();
    // const favorits = await Favorite.find({ user_id: user_id }).countDocuments();
    // newUser.favorite = favorits;
    newUser.orders = orders;
    newUser.delivery_address = address;
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          newUser
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// Add a new Users
exports.addUsers = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    // const _error = validateUsers(req.body, language);

    // console.log(validateUsers2(language, req.body));
    setLanguage(language);
    validateUsers(req.body);

    var newUser = new Users({
      phone_number: req.body.phone_number,
    });
    newUser.validate((err) => {
      if (err) {
        let msg = getErrors(err);
        reply.code(200).send(errorAPI(language, 400, msg, msg));
        return;
      }
    });

    // if (_error.error) {
    //   reply
    //     .code(200)
    //     .send(
    //       errorAPI(
    //         language,
    //         400,
    //         _error.error.details[0].message,
    //         _error.error.details[0].message
    //       )
    //     );
    //   return;
    // }
    let verify_code = makeid(4);
    const _user = await Users.findOne({ phone_number: req.body.phone_number });
    if (_user) {
      //login
      // send sms
      if (_user.isBlock == true) {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              405,
              MESSAGE_STRING_ARABIC.USER_BLOCK,
              MESSAGE_STRING_ENGLISH.USER_BLOCK,
              _user
            )
          );
        return;
      } else {
        //login
        const rs = await Users.findByIdAndUpdate(
          _user._id,
          {
            verify_code: verify_code,
            address: req.body.address,
            fcmToken: req.body.fcmToken,
            isVerify: false,
            os: req.body.os,
            lat: parseFloat(req.body.lat),
            lng: parseFloat(req.body.lng),
            token: jwt.sign(
              { _id: _user._id, userType: USER_TYPE.USER },
              config.get("jwtPrivateKey"),
              {
                expiresIn: "365d",
              }
            ),
          },
          { new: true }
        );
        let msg = "مرحبا بكم في تطبيق منصة wishy-ويشي رمز التفعيل هو: " + verify_code;
        console.log(req.body.phone_number)
        sendSMS(req.body.phone_number, "", "", msg);

        const address = await User_Address.find({
          $and: [{ user_id: rs._id }],
        });
        var newUser = rs.toObject();
        const orders = await Order.find({
          $and: [{ user_id: rs._id }, { StatusId: 4 }],
        }).countDocuments();
        // const favorits = await Favorite.find({
        //   user_id: rs._id,
        // }).countDocuments();
        // newUser.favorite = favorits;
        newUser.orders = orders;
        newUser.delivery_address = address;
       

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              newUser
            )
          );
        return;
      }
    } else {
      //register
      //send sms
      let user = new Users({
        full_name: "",
        email: "",
        password: "",
        phone_number: req.body.phone_number,
        os: req.body.os,
        lat: parseFloat(req.body.lat),
        lng: parseFloat(req.body.lng),
        coordinates:[req.body.lat, req.body.lng],
        fcmToken: req.body.fcmToken,
        createAt: getCurrentDateTime(),
        verify_code: verify_code,
        isVerify: false,
        isBlock: false,
        wallet: 0,
        isEnableNotifications: true,
        token: "",
        image: "",
        address: req.body.address,
      });
      let rs = await user.save();
      let msg = "مرحبا بكم في تطبيق منصة wishy-ويشي رمز التفعيل هو: " + verify_code;
      console.log(req.body.phone_number)
      sendSMS(req.body.phone_number, "", "", msg);
      

      const address = await User_Address.find({
        $and: [{ user_id: rs._id }],
      });
      var newUser = rs.toObject();
      const orders = await Order.find({
        $and: [{ user_id: rs._id }, { StatusId: 4 }],
      }).countDocuments();
      // const favorits = await Favorite.find({
      //   user_id: rs._id,
      // }).countDocuments();
      // newUser.favorite = favorits;
      newUser.orders = orders;
      newUser.delivery_address = address;

      

      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.CREATE_USER,
            MESSAGE_STRING_ENGLISH.CREATE_USER,
            newUser
          )
        );
      return;
    }
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

//verfy code
exports.verify = async (req, reply) => {
  const language = req.headers["accept-language"];

  setLanguage(language);
  validateUsers(req.body);

  var newUser = new Users({
    phone_number: req.body.phone_number,
  });
  newUser.validate((err) => {
    if (err) {
      let msg = getErrors(err);
      reply.code(200).send(errorAPI(language, 400, msg, msg));
      return;
    }
  });

  const _user = await Users.findOne({
    $and: [{ _id: req.body.id }, { phone_number: req.body.phone_number }],
  });
  if (!_user) {
    reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.USER_NOT_FOUND,
          MESSAGE_STRING_ENGLISH.USER_NOT_FOUND
        )
      );
    return;
  }
  if (_user.verify_code == req.body.verify_code) {
    const _Users = await Users.findById(req.body.id);
    if (_Users) {
      const update = await Users.findByIdAndUpdate(
        req.body.id,
        {
          phone_number: req.body.phone_number,
          isVerify: true,
          by: req.body.by,
          token: jwt.sign(
            { _id: _user._id, userType: USER_TYPE.USER },
            config.get("jwtPrivateKey"),
            {
              expiresIn: "365d",
            }
          ),
        },
        { new: true }
      );
      const address = await User_Address.find({
        $and: [{ user_id: update._id }],
      });
      var newUser = update.toObject();
      const orders = await Order.find({
        $and: [{ user_id: update._id }, { StatusId: 4 }],
      }).countDocuments();
      // const favorits = await Favorite.find({
      //   user_id: update._id,
      // }).countDocuments();
      // newUser.favorite = favorits;
      newUser.orders = orders;
      newUser.delivery_address = address;

      var orderNo = `#${utils.makeid(6)}`;
      const settings = await setting.findOne({code:"WALLET_REFERAL"});
      await NewPayment(update._id, orderNo, "دعوة من احد الأصدقاء", "+" , Number(settings.value), "Online")
      if(req.body.by && req.body.by != "") {
        console.log(req.body.by)
        await NewPayment(req.body.by, orderNo, "دعوة من احد الأصدقاء", "+", Number(settings.value), "Online")
      }

      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.USER_VERIFY,
            MESSAGE_STRING_ENGLISH.USER_VERIFY,
            newUser
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
            MESSAGE_STRING_ARABIC.USER_VERIFY_SUCCESS,
            MESSAGE_STRING_ENGLISH.USER_VERIFY_SUCCESS
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
          MESSAGE_STRING_ARABIC.USER_VERIFY_ERROR,
          MESSAGE_STRING_ENGLISH.USER_VERIFY_ERROR
        )
      );
    return;
  }
};

exports.forgetPassword = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _Users = await Users.findOne({phone_number: String(req.body.phone_number)});
    if (_Users) {
      var newPassword = makeid(8);
      let pass = encryptPassword(newPassword);
      const update = await Users.findByIdAndUpdate(
        _Users._id,
        { password: pass },
        { new: true }
      );

      const address = await User_Address.find({
        $and: [{ user_id: update._id }],
      });
      var newUser = update.toObject();
      const orders = await Order.find({
        $and: [{ user_id: update._id }, { StatusId: 4 }],
      }).countDocuments();
      // const favorits = await Favorite.find({
      //   user_id: update._id,
      // }).countDocuments();
      // newUser.favorite = favorits;
      newUser.orders = orders;
      newUser.delivery_address = address;

      var data = {
        full_name: _Users.full_name,
        newPassword: newPassword,
      };

      //mail_reset_password(req, req.body.email, "استعادة كلمة المرور", "", data);

      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.USER_FORGET_PASSWORD_SUCCESS,
            MESSAGE_STRING_ENGLISH.USER_FORGET_PASSWORD_SUCCESS,
            newUser
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
            MESSAGE_STRING_ARABIC.USER_FORGET_PASSWORD_ERROR,
            MESSAGE_STRING_ENGLISH.USER_FORGET_PASSWORD_ERROR
          )
        );
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

// Update an existing Users
exports.updateProfile = async (req, reply) => {
  const language = req.headers["accept-language"];
  // try {
    console.log(req.user._id)
    if (
      !req.raw.body.email ||
      !req.raw.body.full_name ||
      !req.raw.body.lat ||
      !req.raw.body.lng
    ) {
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

    const _Users = await Users.findOne({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [{ email: String(req.raw.body.email).toLowerCase() }],
        },
      ],
    });
    if (_Users) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.USER_EXSIT,
            MESSAGE_STRING_ENGLISH.USER_EXSIT
          )
        );
      return;
    } else {
      if (req.raw.files) {
        const files = req.raw.files;
        let fileArr = [];
        for (let key in files) {
          fileArr.push({
            name: files[key].name,
            mimetype: files[key].mimetype,
          });
        }
        var data = Buffer.from(files.image.data);
        fs.writeFile(
          "./uploads/" + files.image.name,
          data,
          "binary",
          function (err) {
            if (err) {
              console.log("There was an error writing the image");
            } else {
              console.log("The sheel file was written");
            }
          }
        );

        let img = "";
        await uploadImages(files.image.name).then((x) => {
          img = x;
        });

        if (req.raw.body.lat && req.raw.body.lng && req.raw.body.address) {
          await User_Address.deleteMany({ user_id: req.user._id },function (err, docs) {});

          // let rs = new User_Address({
          //   lat: req.raw.body.lat,
          //   lng: req.raw.body.lng,
          //   address: req.raw.body.address,
          //   user_id: req.user._id,
          //   isDefault: true,
          // });
          // await rs.save();

          const _newUser = await Users.findByIdAndUpdate(
            req.user._id,
            {
              lat: req.raw.body.lat,
              lng: req.raw.body.lng,
              address: req.raw.body.address,

              streetName: req.raw.body.streetName,
              floorNo: req.raw.body.floorNo,
              buildingNo: req.raw.body.buildingNo,
              flatNo: req.raw.body.flatNo
            },
            { new: true }
          );
        }

        const _newUser = await Users.findByIdAndUpdate(
          req.user._id,
          {
            image: img,
            email: String(req.raw.body.email).toLowerCase(),
            full_name: req.raw.body.full_name,
          },
          { new: true }
        ).select();
        console.log(_newUser)
        const address = await User_Address.find({$and: [{ user_id: _newUser._id }]});
        var newUser = _newUser.toObject();
        const orders = await Order.find({ $and: [{ user_id: _newUser._id }, { status: {$in:[ORDER_STATUS.prefinished, ORDER_STATUS.finished, ORDER_STATUS.rated]} }]}).countDocuments();
        // const favorits = await Favorite.find({ user_id: _newUser._id}).countDocuments();
        // newUser.favorite = favorits;
        newUser.orders = orders;
        newUser.delivery_address = address;

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              newUser
            )
          );
        return;
      } else {
        if (req.raw.body.lat && req.raw.body.lng && req.raw.body.address) {
          await User_Address.deleteMany(
            { user_id: req.user._id },
            function (err, docs) {}
          );

          // let rs = new User_Address({
          //   lat: req.raw.body.lat,
          //   lng: req.raw.body.lng,
          //   address: req.raw.body.address,
          //   user_id: req.user._id,
          //   isDefault: true,
          // });
          // await rs.save();

          await Users.findByIdAndUpdate(
            req.user._id,
            {
              lat: req.raw.body.lat,
              lng: req.raw.body.lng,
              address: req.raw.body.address,
              streetName: req.raw.body.streetName,
              floorNo: req.raw.body.floorNo,
              buildingNo: req.raw.body.buildingNo,
              flatNo: req.raw.body.flatNo
            },
            { new: true }
          );
        }

        const _newUser = await Users.findByIdAndUpdate(
          req.user._id,
          {
            email: String(req.raw.body.email).toLowerCase(),
            full_name: req.raw.body.full_name,
          },
          { new: true }
        ).select();

        const address = await User_Address.find({
          $and: [{ user_id: _newUser._id }],
        });
        var newUser = _newUser.toObject();
        const orders = await Order.find({
          $and: [{ user_id: _newUser._id }, { StatusId: 4 }],
        }).countDocuments();
        // const favorits = await Favorite.find({
        //   user_id: _newUser._id,
        // }).countDocuments();
        // newUser.favorite = favorits;
        newUser.orders = orders;
        newUser.delivery_address = address;

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              newUser
            )
          );
        return;
      }
    }
  // } catch (err) {
  //   reply.code(200).send(errorAPI(language, 400, err.message, err.message));
  //   return;
  // }
};

exports.uploadUserPhoto = async (req, reply) => {
  if (req.raw.files) {
    const files = req.raw.files;
    let fileArr = [];
    for (let key in files) {
      fileArr.push({
        name: files[key].name,
        mimetype: files[key].mimetype,
      });
    }
    var data = Buffer.from(files.image.data);
    fs.writeFile(
      "./uploads/" + files.image.name,
      data,
      "binary",
      function (err) {
        if (err) {
          console.log("There was an error writing the image");
        } else {
          console.log("The sheel file was written");
        }
      }
    );

    let img = "";
    await uploadImages(files.image.name).then((x) => {
      img = x;
    });

    const response = {
      status_code: 200,
      status: true,
      messageAr: "تمت العملية بنجاح",
      messageEn: "Updated Successfully",
      items: img,
    };
    reply.code(200).send(response);
  }
};

exports.updateUserAndroid = async (req, reply) => {
  try {
    const user_id = req.user._id;
    const preUser = await Users.findById(user_id);
    var lat = preUser.lat;
    var lng = preUser.lng;
    var address = preUser.address;
    if (Number(req.body.lat) && Number(req.body.lng)) {
      // await getAddress(Number(req.body.lat), Number(req.body.lng)).then((x) => {
      //   address = x;
      // });
      var lat = Number(req.body.lat);
      var lng = Number(req.body.lng);
    }
    if (req.body.image) {
      const user = await Users.findByIdAndUpdate(
        user_id,
        {
          image: req.body.image,
          address: req.body.address,
          full_name: req.body.full_name,
          email: String(req.body.email).toLowerCase(),
          city_id: req.body.city_id,
          lat: lat,
          lng: lng,
        },
        { new: true }
      );

      const response = {
        status_code: 200,
        status: true,
        messageAr: "تمت العملية بنجاح",
        messageEn: "Updated Successfully",
        items: user,
      };
      reply.send(response);
    } else {
      const user = await Users.findByIdAndUpdate(
        user_id,
        {
          address: req.body.address,
          full_name: req.body.full_name,
          email: String(req.body.email).toLowerCase(),
          lat: lat,
          lng: lng,
        },
        { new: true }
      );

      const response = {
        status_code: 200,
        status: true,
        messageAr: "تمت العملية بنجاح",
        messageEn: "Updated Successfully",
        items: user,
      };
      reply.send(response);
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.changePhone = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const User_id = req.user._id;

    var _error = Joi.assert(
      req.body.phone_number,
      Joi.number()
        .empty()
        .required()
        .error((errors) => {
          errors.forEach((err) => {
            console.log(err.code);
            switch (err.code) {
              case "any.required":
              case "number.base":
              case "number.empty":
                if (language == LANGUAGE_ENUM.EN) {
                  err.message = VALIDATION_MESSAGE_ENGLISH.PHONE_REQUIRED;
                } else {
                  err.message = VALIDATION_MESSAGE_ARABIC.PHONE_REQUIRED;
                }
                break;
              default:
                break;
            }
          });
          return errors;
        })
    );
    if (_error && _error.error) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            _error.error.details[0].message,
            _error.error.details[0].message
          )
        );
      return;
    }

    //send sms
    const _user = await Users.findOne({
      $and: [
        { _id: { $ne: User_id } },
        { phone_number: req.body.phone_number },
      ],
    });
    if (_user) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.USER_EXSIT3,
            MESSAGE_STRING_ENGLISH.USER_EXSIT3
          )
        );
      return;
    }

    const sms_code = makeid(4);

    const update = await Users.findByIdAndUpdate(
      User_id,
      { verify_code: sms_code, isVerify: false },
      { new: true }
    )
      .populate("country_id")
      .populate("city_id");

    var newUser = update.toObject();
    var country = {
      _id: update.country_id._id,
      name: update.country_id[`${language}Name`],
      flag: update.country_id.flag ? update.country_id.flag : "",
      code: update.country_id.code ? update.country_id.code : "",
    };
    var city = {
      _id: update.city_id._id,
      name: update.city_id[`${language}Name`],
    };

    newUser.country_id = country;
    newUser.city_id = city;
    var msg = ""
    if (language == LANGUAGE_ENUM.EN) {
      msg = MESSAGE_STRING_ENGLISH.WELCOME + sms_code;
    } else {
      msg = MESSAGE_STRING_ARABIC.WELCOME + sms_code;
    }

    sendSMS(update.phone_number, "", "", msg);


    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SEND_SMS,
          MESSAGE_STRING_ENGLISH.SEND_SMS,
          update
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

//logout
exports.logout = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const User_id = req.params.id;
    console.log(User_id)
    const checkUser = await Users.findById(User_id);
    console.log(checkUser)
    if (!checkUser) {
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
    const user = await Users.findByIdAndUpdate(
      User_id,
      {
        fcmToken: "",
        token: "",
      },
      { new: true }
    );
    reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.USER_LOGOUT,
            MESSAGE_STRING_ENGLISH.USER_LOGOUT,
            {}
          )
        );
      return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

//refresh API token
exports.refreshAPIToken = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const User_id = req.body.id;
    const user = await Users.findByIdAndUpdate(
      User_id,
      {
        token: jwt.sign(
          { _id: _user._id, userType: USER_TYPE.USER },
          config.get("jwtPrivateKey"),
          {
            expiresIn: "365d",
          }
        ),
      },
      { new: true }
    );

    if (!user) {
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
    } else {
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.SUCCESS,
            MESSAGE_STRING_ENGLISH.SUCCESS,
            user
          )
        );
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

//refresh FCM token
exports.refreshFCMToken = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const User_id = req.body.id;
    const user = await Users.findByIdAndUpdate(
      User_id,
      {
        fcmToken: req.body.fcmToken,
      },
      { new: true }
    );

    if (!user) {
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
    } else {
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.SUCCESS,
            MESSAGE_STRING_ENGLISH.SUCCESS,
            user
          )
        );
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.userslist = async (req, reply) => {
  try {
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const total = await Users.find().countDocuments();
    var result = [];
    const xx = await Users.find()
      .select(["-token", "-password"])
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    result = xx;
    const response = {
      items: result,
      status_code: 200,
      message: "returned successfully",
      pagenation: {
        size: result.length,
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

exports.block = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user = await Users.findByIdAndUpdate(
      req.body._id,
      {
        isBlock: req.body.isBlock,
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
        {}
      )
    );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAllUsers = async (req, reply) => {
  try {
    var result = [];
    const xx = await Users.find();
    result = xx;
    const response = {
      items: result,
      status_code: 200,
      message: "returned successfully",
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteUser = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    await Users.findByIdAndRemove(req.params.id);
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

exports.guestToken = async (req, reply) => {
  var token = jwt.sign(
    { _id: "5e0866b91c9d440000299743", userType: "guest" },
    config.get("jwtPrivateKey"),
    {
      expiresIn: "365d",
    }
  );
  const response = {
    status_code: 200,
    status: true,
    messageAr: "تمت العملية بنجاح",
    messageEn: "Saved successfully",
    items: token,
  };
  reply.send(response);
};

exports.Resend = async (req, reply) => {
  const language = req.headers["accept-language"];
  var msg = "";
  const sms_code = makeid(4);

  if (!req.body.id) {
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
  const checkUser = await Users.findById(req.body.id);
  if (!checkUser) {
    reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.USER_NOT_FOUND,
          MESSAGE_STRING_ENGLISH.USER_NOT_FOUND
        )
      );
    return;
  }
  const user = await Users.findByIdAndUpdate(
    req.body.id,
    {
      verify_code: sms_code,
    },
    { new: true }
  );
  const address = await User_Address.find({
    $and: [{ user_id: user._id }],
  });
  var newUser = user.toObject();
  const orders = await Order.find({
    $and: [{ user_id: user._id }, { StatusId: 4 }],
  }).countDocuments();
  // const favorits = await Favorite.find({ user_id: user._id }).countDocuments();
  // newUser.favorite = favorits;
  newUser.orders = orders;
  newUser.delivery_address = address;
  if (language == LANGUAGE_ENUM.EN) {
    msg = MESSAGE_STRING_ENGLISH.WELCOME + sms_code;
  } else {
    msg = MESSAGE_STRING_ARABIC.WELCOME + sms_code;
  }

  sendSMS(user.phone_number, "", "", msg);
  reply
    .code(200)
    .send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        newUser
      )
    );
};

exports.AddSMS = async (req, reply) => {
  let msg = req.body.msg;
  let phone = req.body.phone_number;

  sendSMS(phone, "", "", msg);
  
  const response = {
    status_code: 200,
    status: true,
    message: "تم ارسال الرسالة بنجاح",
    items: null,
  };
  reply.code(200).send(response);
};

exports.getUserAddress = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;
    var checkUserAddress = await User_Address.find({ user_id: user_id });

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          checkUserAddress
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getUserAddressType = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;
    var checkUserAddress = await User_Address.find({ $and:[{user_id: user_id}, {type:req.params.type}] });
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          checkUserAddress
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addUserAddress = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;

    if (!req.body.lat || !req.body.lng || !req.body.address) {
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

    var checkUserAddress = await User_Address.find({ user_id: user_id });
    var isDefault = true;
    if (checkUserAddress.length > 0) {
      isDefault = false;
    }
    let rs = new User_Address({
      title: req.body.title,
      lat: req.body.lat,
      lng: req.body.lng,
      address: req.body.address,
      user_id: user_id,
      isDefault: isDefault,
      discount: 0,

      streetName: req.body.streetName,
      floorNo: req.body.floorNo,
      buildingNo: req.body.buildingNo,
      flatNo: req.body.flatNo,
      type: req.body.type
    });

    let _rs = await rs.save();

    await Users.findByIdAndUpdate(
      user_id,
      {
        address: req.body.address,
        lat: parseFloat(req.body.lat),
        lng: parseFloat(req.body.lng),
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
          _rs
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateUserAddress = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;

    if (!req.body.lat || !req.body.lng || !req.body.address) {
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

    var _rs = await User_Address.findByIdAndUpdate(
      req.body.id,
      {
        title: req.body.title,
        address: req.body.address,
        streetName: req.body.streetName,
        floorNo: req.body.floorNo,
        buildingNo: req.body.buildingNo,
        flatNo: req.body.flatNo,
        type: req.body.type,
        lat: parseFloat(req.body.lat),
        lng: parseFloat(req.body.lng),
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
          _rs
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.deleteUserAddress = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;
    await User_Address.findByIdAndRemove(req.body.id);
    var checkUserAddress = await User_Address.find({ user_id: user_id });
    if (checkUserAddress.length > 0) {
      var _rs = await User_Address.findByIdAndUpdate(checkUserAddress[0]._id, { isDefault: true}, { new: true });
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

exports.defaultUserAddress = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    await User_Address.updateMany(
      { user_id: req.user._id },
      { isDefault: false },
      function (err) {}
    );

    await User_Address.findByIdAndUpdate(
      req.body.id,
      {
        isDefault: true,
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
          MESSAGE_STRING_ENGLISH.SUCCESS
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addUnCoveredOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;
    const user_type = req.user.userType;

    var address = "";
    // getAddress(req.body.lat, req.body.lng).then((x) => {
    //   address = x;
    // });
    let rs = new User_Uncovered({
      user_id: user_id,
      user_type: user_type,
      lat: req.body.lat,
      lng: req.body.lng,
      address: address,
    });

    let _rs = await rs.save();
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _rs
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getUnCovered = async (req, reply) => {
  try {
    let searchDate = moment()
      .add(-6, "months")
      .startOf("day")
      .tz("Asia/Riyadh");

    const item = await User_Uncovered.find({ createAt: { $gte: searchDate } });
    // .limit(2000)
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

///////////Admin////////////
exports.getUsers = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    let search_field = req.body.search_field;
    let search_value = req.body.search_value;
    let user_type = req.body.user_type;

    let query1 = {};
    query1[search_field] = { $regex: new RegExp(search_value, "i") };

    if(user_type == "delete"){
      query1['isBlock'] = true
    }
    if(user_type == "active"){
      query1['isBlock'] = false
    }
  if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query1["createAt"]= { $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)), $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)) }
    }
    const total = await Users.find(query1).countDocuments();
    const item = await Users.find(query1)
      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 });

    var newArr = [];
    for await (const data of item) {
      var newUser = data.toObject();
      var _order = await Order.countDocuments({$and: [{ user_id: newUser._id }]});
      var _favorite = await Favorite.countDocuments({$and: [{ user_id: newUser._id }]});
      var _referal = await Friend.countDocuments({user_id:data._id})
      newUser.referal = _referal
      newUser.orders = _order;
      newUser.favorite = _favorite;
      newArr.push(newUser);
    }

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: newArr,
      pagenation: {
        size: newArr.length,
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

exports.getUsersExcel = async (req, reply) => {
  try {
    let search_field = req.body.search_field;
    let search_value = req.body.search_value;

    let user_type = req.body.user_type;

    let query1 = {};
    query1[search_field] = { $regex: new RegExp(search_value, "i") };

    if(user_type == "delete"){
      query1['isBlock'] = true
    }
    if(user_type == "active"){
      query1['isBlock'] = false
    }
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query1["createAt"]= { $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)), $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)) }
    }
    const item = await Users.find(query1)
      .populate("city_id")
      .populate("country_id")
      .sort({ _id: -1 });
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getUserAddressAdmin = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    let userId = req.params.id;
    const total = await User_Address.find({ user_id: userId }).countDocuments();
    const items = await User_Address.find({ user_id: userId })
      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 });

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: items,
      pagenation: {
        size: items.length,
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

exports.sendUserSMS = async (req, reply) => {
  const language = req.headers["accept-language"];
  let user = await Users.findById(req.params.id);
  if (!user) {
    const response = {
      status_code: 400,
      status: false,
      message: "حدث خطأ .. الرجاء المحاولة فيما بعد",
      items: null,
    };
    reply.code(200).send(response);
  }
  let msg = req.body.msg;

  sendSMS(user.phone_number, "", "", msg);
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
};

exports.getSingleUsersAdmin = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.params.id;
    const _Users = await Users.findById(user_id).select();
    if (!_Users) {
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
    var newUser = _Users.toObject();
    var _order = await Order.find({
      $and: [{ user_id: newUser._id }, { StatusId: 4 }],
    }).countDocuments();
    var _favorite = await Favorite.find({
      user_id: newUser._id,
    }).countDocuments();

    newUser.orders = _order;
    newUser.favorites = _favorite;

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          newUser
        )
      );
    return;
  } catch (err) {
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
};

exports.updateUser = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    setLanguage(language);
    var newUser = new Users({
      phone_number: req.raw.body.phone_number,
    });
    newUser.validate((err) => {
      if (err) {
        let msg = getErrors(err);
        reply.code(200).send(errorAPI(language, 400, msg, msg));
        return;
      }
    });

    if (
      !req.raw.body.email ||
      !req.raw.body.full_name ||
      !req.raw.body.address
    ) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ALL_FIELD_REQUIRED,
            MESSAGE_STRING_ENGLISH.ALL_FIELD_REQUIRED
          )
        );
      return;
    }

    if (!emailRegex.test(req.raw.body.email)) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.INVALID_EMAIL,
            VALIDATION_MESSAGE_ENGLISH.INVALID_EMAIL
          )
        );
      return;
    }
    const _Users = await Users.findOne({
      $and: [
        { _id: { $ne: req.raw.body._id } },
        {
          $or: [
            { email: String(req.raw.body.email).toLowerCase() },
            { phone_number: req.raw.body.phone_number },
          ],
        },
      ],
    });
    if (_Users) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.USER_EXSIT,
            MESSAGE_STRING_ENGLISH.USER_EXSIT
          )
        );
      return;
    } else {
      if (req.raw.files) {
        const files = req.raw.files;
        let fileArr = [];
        for (let key in files) {
          fileArr.push({
            name: files[key].name,
            mimetype: files[key].mimetype,
          });
        }
        var data = Buffer.from(files.image.data);
        fs.writeFile(
          "./uploads/" + files.image.name,
          data,
          "binary",
          function (err) {
            if (err) {
              console.log("There was an error writing the image");
            } else {
              console.log("The sheel file was written");
            }
          }
        );

        let img = "";
        await uploadImages(files.image.name).then((x) => {
          img = x;
        });

        const _newUser = await Users.findByIdAndUpdate(
          req.raw.body._id,
          {
            image: img,
            email: String(req.raw.body.email).toLowerCase(),
            address: req.raw.body.address,
            full_name: req.raw.body.full_name,
            streetName: req.raw.body.streetName,
            floorNo: req.raw.body.floorNo,
            buildingNo: req.raw.body.buildingNo,
            flatNo: req.raw.body.flatNo
          },
          { new: true }
        ).select();

        var newUser = _newUser.toObject();
        var _order = await Order.find({
          $and: [{ user_id: newUser._id }, { StatusId: 4 }],
        }).countDocuments();
        var _favorite = await Favorite.find({
          user_id: newUser._id,
        }).countDocuments();
        newUser.orders = _order;
        newUser.favorites = _favorite;

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.UPDATE_PROFILE,
              MESSAGE_STRING_ENGLISH.UPDATE_PROFILE,
              newUser
            )
          );
        return;
      } else {
        const _newUser = await Users.findByIdAndUpdate(
          req.raw.body._id,
          {
            email: String(req.raw.body.email).toLowerCase(),
            address: req.raw.body.address,
            full_name: req.raw.body.full_name,
            streetName: req.raw.body.streetName,
            floorNo: req.raw.body.floorNo,
            buildingNo: req.raw.body.buildingNo,
            flatNo: req.raw.body.flatNo
          },
          { new: true }
        ).select();

        var newUser = _newUser.toObject();
        var _order = await Order.find({
          $and: [{ user_id: newUser._id }, { StatusId: 4 }],
        }).countDocuments();
        var _favorite = await Favorite.find({
          user_id: newUser._id,
        }).countDocuments();

        newUser.orders = _order;
        newUser.favorites = _favorite;

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.UPDATE_PROFILE,
              MESSAGE_STRING_ENGLISH.UPDATE_PROFILE,
              newUser
            )
          );
        return;
      }
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateUserAddressAdmin = async (req, reply) => {
  var _rs = await User_Address.findByIdAndUpdate(
    req.params.id,
    {
      discount: req.body.discount,
    },
    { new: true }
  );
  const response = {
    status_code: 200,
    status: true,
    message: "تم حفظ المعلومات بنجاح",
    items: _rs,
  };
  reply.code(200).send(response);
};

exports.updateWallet = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var orderNo = `${makeOrderNumber(6)}`;
    const _user = await NewPayment(req.user._id, orderNo ,"شحن المحفظة الالكترونية", "+", req.body.amount, "Online" );
    // if(req.body.coupon && req.body.coupon != ""){
    //   let usage = new coupon_usage({
    //     coupon: req.body.coupon,
    //     dt_date: getCurrentDateTime(),   
    //     amount: Number(req.body.amount),
    //     user: req.user._id
    //   });
    //   await usage.save()
    // }
    reply
    .code(200)
    .send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        _user
      )
    );   
  } catch (err) {
    throw boom.boomify(err);
  }
};


exports.referalDeepLink = async (req, reply) => {
  // let msg = req.body.msg;
  const language = req.headers["accept-language"];
  const user = await Users.findById(req.user._id);
  var body = {
      "dynamicLinkInfo": {
      "domainUriPrefix": "https://khawi.page.link",
      "link": "https://google.com?referal_id="+user._id,
      "androidInfo": {
        "androidPackageName": "com.khawi",
        "androidFallbackLink": "https://google.com"
      },
      "iosInfo": {
        "iosBundleId": "com.Fazaa.Khawi",
        "iosFallbackLink": "https://google.com",
      },
      "navigationInfo": {
        "enableForcedRedirect": true
      }
    },
    "suffix": {
      "option": "UNGUESSABLE"
    }
  };

  let _config = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const url = "https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyBR15gqERpWd0IbmAk1zGIGur_hrlRbEm4";
  axios
  .post(url, body, {})
  .then(async (response) => {
    if(response.data){
      let obj = {
        shortLink: response.data.shortLink,
        previewLink: response.data.previewLink,
      }
      reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          obj
        )
      );  
    }else{
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.USER_BLOCK,
          MESSAGE_STRING_ENGLISH.USER_BLOCK,
          null
        )
      );
    return;
    }
  })
  .catch((error) => {
    reply
    .code(200)
    .send(
      errorAPI(
        language,
        400,
        MESSAGE_STRING_ARABIC.USER_BLOCK,
        MESSAGE_STRING_ENGLISH.USER_BLOCK,
        null
      )
    );
  return;
  });
};


// Add a new Users
exports.addCompany = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _user = await Companies.findOne({ phone_number: req.body.phone_number });
    if (_user) {
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          405,
          MESSAGE_STRING_ARABIC.USER_EXSIT,
          MESSAGE_STRING_ENGLISH.USER_EXSIT,
          {}
        )
      );
    return;
    } else {
      let user = new Companies({
        company_name: req.body.company_name,
        email: req.body.email,
        phone_number: req.body.phone_number,
        address: req.body.address,
        lat: parseFloat(req.body.lat),
        lng: parseFloat(req.body.lng),
        createAt: getCurrentDateTime(),
      });
      let rs = await user.save();
      let msg = "مرحبا بكم في تطبيق منصة wishy-ويشي سيتم التواصل معكم في أقرب وقت ممكن: ";
      sendSMS(req.body.phone_number, "", "", msg);
      
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.CREATE_USER,
            MESSAGE_STRING_ENGLISH.CREATE_USER,
            rs
          )
        );
      return;
    }
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getCompany = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    const total = await Companies.countDocuments();
    const item = await Companies.find()
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
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

exports.refund_test = async (req, reply) => {
  // try {
    response = null;
    await utils.refund(req.params.id, req.body.amount).then((x) => {
      response = x;
    });
    reply.send(response)
  // } catch (err) {
  //   throw boom.boomify(err);
  // }
};



/////////////////Wish/////////////////
exports.addWishGroup = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _user = await WishGroup.findOne({ $and:[{name: req.body.name},{user_id: req.user._id}] });
    if (_user) {
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          405,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT,
          {}
        )
      );
    return;
    } else {
      let user = new WishGroup({
        name: req.body.name,
        user_id: req.user._id,
        createAt: getCurrentDateTime(),
      });
      let rs = await user.save();  
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
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateWishGroup = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _setting = await WishGroup.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
      },
      { new: true, runValidators: true },
      function (err, model) {
        var _return = handleError(err);
        if (_return.length > 0) {
          reply.code(200).send({
            status_code: 400,
            status: false,
            message: _return[0],
            items: _return,
          });
          return;
        }
      }
    );

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _setting
        )
      );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteWishGroup = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    await WishGroup.findByIdAndRemove(req.params.id);
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
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getSingleWishGroup = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const StaticPages = await WishGroup.findById(req.params.id);
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          StaticPages
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getWishGroupByUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    console.log(req.query.page);
    console.log(req.query.limit);
    
    if(req.query.page != null && req.query.limit != null){
      const total = await WishGroup.countDocuments({ user_id: req.query.user_id });
      const items = await WishGroup.find({ user_id: req.query.user_id })
        .populate({path: "user_id"})
        .skip(page * limit)
        .limit(limit)
        .sort({ _id: -1 });
  
      var arr = []
      for await(const i of items){
        var obj = i.toObject();
        var prods = []
        var products = await Wish.find({$and:[{group_id: i._id},{user_id: req.query.user_id}]}).populate("product_id");
        for await (const p of products) {
          var el = p.product_id.toObject();
          delete el.arName;
          delete el.enName;
          delete el.arDescription;
          delete el.enDescription;
          el.name = el[`${language}Name`];
          el.description = el[`${language}Description`];
          prods.push(el)
        }
        obj.items = prods
        arr.push(obj)
      }
      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          arr,
          {
            size: items.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
          })
      );
    }else{
      const items = await WishGroup.find({ user_id: req.query.user_id })
        .populate({path: "user_id"})
        .sort({ _id: -1 });
  
      var arr = []
      for await(const i of items){
        var obj = i.toObject();
        var prods = []
        var products = await Wish.find({$and:[{group_id: i._id},{user_id: req.query.user_id}]}).populate("product_id");
        for await (const p of products) {
          var el = p.product_id.toObject();
          delete el.arName;
          delete el.enName;
          delete el.arDescription;
          delete el.enDescription;
          el.name = el[`${language}Name`];
          el.description = el[`${language}Description`];
          prods.push(el)
        }
        obj.items = prods
        arr.push(obj)
      }
      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          arr)
      );
    }

  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addWish = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _user = await Wish.findOne({ $and:[{product_id: req.body.product_id}, {group_id: req.body.group_id}] });
    if (_user) {
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          405,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT,
          {}
        )
      );
    return;
    } else {
      var EXP = await setting.findOne({code: "EXP_TIME"});
      var today = moment().tz("Asia/Riyadh").startOf('day')
      var finish = req.body.type == 'public' ? today.add(Number(EXP.value), 'days') : today
      let user = new Wish({
        product_id: req.body.product_id,
        group_id: req.body.group_id,
        isShare: req.body.isShare,
        type: req.body.type,
        total: req.body.total,
        all_pays: 0,
        user_id: req.user._id,
        pays: [],
        title: req.body.title,
        description: req.body.description,
        createAt: getCurrentDateTime(),
        finishAt: finish
      });
      let rs = await user.save();
      //send sms to pays if private
      
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
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateWish = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var EXP = await setting.findOne({code: "EXP_TIME"});
    var today = moment().tz("Asia/Riyadh").startOf('day')
    var finish = req.body.type == 'public' ? today.add(Number(EXP.value), 'days') : today
    const _setting = await Wish.findByIdAndUpdate(
      req.params.id,
      {
        product_id: req.body.product_id,
        group_id: req.body.group_id,
        isShare: req.body.isShare,
        type: req.body.type,
        total: req.body.total,
        title: req.body.title,
        description: req.body.description,
        finishAt: finish
      },
      { new: true, runValidators: true },
      function (err, model) {
        var _return = handleError(err);
        if (_return.length > 0) {
          reply.code(200).send({
            status_code: 400,
            status: false,
            message: _return[0],
            items: _return,
          });
          return;
        }
      }
    );

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _setting
        )
      );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteWish = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    await Wish.findByIdAndRemove(req.params.id);
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
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getSingleWish = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const StaticPages = await Wish.findById(req.params.id)
    .populate({path: "user_id"})
    .populate({path: "product_id"})
    .populate({path: "group_id"});

    const newObj = StaticPages.toObject();
    delete newObj.product_id.arName;
    delete newObj.product_id.enName;
    delete newObj.product_id.arDescription;
    delete newObj.product_id.enDescription;
    newObj.product_id.name = StaticPages.product_id[`${language}Name`];
    newObj.product_id.description = StaticPages.product_id[`${language}Description`];

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          newObj
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getWishByUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var returnArr = []
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {$and:[{user_id: req.query.user_id}]}
    if (req.query.group_id && req.query.group_id != ""){
      query.$and.push({group_id: req.query.group_id})
    }
    if (req.query.isShare && req.query.isShare != ""){
      query.$and.push({isShare: req.query.isShare})
    }
    
    const total = await Wish.countDocuments(query);
    const items = await Wish.find(query)
    .populate({path: "user_id"})
    .populate({path: "product_id"})
    .populate({path: "group_id"})
    .skip(page * limit)
    .limit(limit)
    .sort({ _id: -1 });

      items.forEach(element => {
        const newObj = element.toObject();
        delete newObj.product_id.arName;
        delete newObj.product_id.enName;
        delete newObj.product_id.arDescription;
        delete newObj.product_id.enDescription;
        newObj.product_id.name = element.product_id[`${language}Name`];
        newObj.product_id.description = element.product_id[`${language}Description`];
        returnArr.push(newObj);
      });

      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          returnArr,
          {
            size: items.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
         })
      );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getExploreWish = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var returnArr = []
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var end =  moment().tz("Asia/Riyadh").startOf('day')
    var query = {$and:[{type: "public"}, { finishAt: {$gte: end} }]}
    
    const total = await Wish.countDocuments(query);
    const items = await Wish.find(query)
    .populate({path: "user_id"})
    .populate({path: "product_id"})
    .populate({path: "group_id"})
    .skip(page * limit)
    .limit(limit)
    .sort({ _id: -1 });

    items.forEach(element => {
      const newObj = element.toObject();
      delete newObj.product_id.arName;
      delete newObj.product_id.enName;
      delete newObj.product_id.arDescription;
      delete newObj.product_id.enDescription;
      newObj.product_id.name = element.product_id[`${language}Name`];
      newObj.product_id.description = element.product_id[`${language}Description`];
      returnArr.push(newObj);
    });

    reply.code(200).send(
      success(
        language, 
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        returnArr,
        {
          size: items.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        })
    );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.paywish = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let pay = {
      user: req.user._id,
      total: req.body.total,
      createAt: getCurrentDateTime(),
    }
    const _setting = await Wish.findByIdAndUpdate(
      req.params.id,
      {
        $push: { pays: pay } ,
        $inc: { all_pays: Number(req.body.total)}
      },
      { new: true },
    );

    if(Number(_setting.total) == Number(_setting.all_pays)){
      //notification to user 
      await Wish.findByIdAndUpdate(req.params.id, { isComplete:true },{ new: true });
      let user = await Users.findById(req.user._id)
      await CreateGeneralNotification(user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم اكتمال مبلغ القطة الخاص بأمنيتك", NOTIFICATION_TYPE.ORDERS, _setting._id, "", user._id, "", "");
    }
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _setting
        )
      );
  } catch (err) {
    throw boom.boomify(err);
  }
};


//////////////Friend///////////////

exports.addCheckFriend = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {

      var check = await Users.findOne({phone_number: req.body.phone_number})
      if(!check){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            405,
            MESSAGE_STRING_ARABIC.USER_NOT_FOUND,
            MESSAGE_STRING_ENGLISH.USER_NOT_FOUND,
            {}
          )
        );
      return;
      }
      const _user = await Friend.findOne({ $and:[{user_id: req.user._id}, {fiend_id: check._id}] });
      if(_user){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            405,
            MESSAGE_STRING_ARABIC.EXIT,
            MESSAGE_STRING_ENGLISH.EXIT,
            {}
          )
        );
        return
      }
      let user = new Friend({
        user_id: req.user._id,
        friend_id: check._id,
        createAt: getCurrentDateTime(),
      });
      let rs = await user.save();

      let user2 = new Friend({
        user_id: check._id,
        friend_id: req.user._id,
        createAt: getCurrentDateTime(),
      });
      let rs2 = await user2.save();
      var current = await Users.findById(req.user._id)

      await CreateGeneralNotification(check.fcmToken, NOTIFICATION_TITILES.FRIEND, "اصبحت صديق لدى "+current.full_name,NOTIFICATION_TYPE.FRIEND, check._id, current._id, check._id,"","")
      //send notification to friend 

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
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.getFriends = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var returnArr = []
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10); 
    const total = await Friend.countDocuments({user_id: req.user._id});
    const items = await Friend.find({user_id: req.user._id})
    .populate({path: "user_id"})
    .populate({path: "friend_id"})
    .skip(page * limit)
    .limit(limit)
    .sort({ _id: -1 });

      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          items,
          {
            size: items.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
         })
      );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

///////////////Reminder/////////////
exports.addReminder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _user = await Reminder.findOne({ $and:[{title: req.body.title }, {user_id: req.user._id}]});
    if (_user) {
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          405,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT,
          {}
        )
      );
    return;
    } else {
      let user = new Reminder({
        title: req.body.title,
        date: req.body.date,
        user_id: req.user._id,
        before: req.body.before,
        createAt: getCurrentDateTime(),
      });
      let rs = await user.save();  
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
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.updateReminder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const _setting = await Reminder.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        date: req.body.date,
        before: req.body.before,
      },
      { new: true, runValidators: true },
      function (err, model) {
        var _return = handleError(err);
        if (_return.length > 0) {
          reply.code(200).send({
            status_code: 400,
            status: false,
            message: _return[0],
            items: _return,
          });
          return;
        }
      }
    );

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _setting
        )
      );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteReminder = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    await Reminder.findByIdAndRemove(req.params.id);
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
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getSingleReminder = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const StaticPages = await Reminder.findById(req.params.id);
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          StaticPages
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getWishReminder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    const total = await Reminder.countDocuments({ user_id: req.user._id });
    const items = await Reminder.find({ user_id: req.user._id })
      .populate({path: "user_id"})
      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 });

      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          items,
          {
            size: items.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
         })
      );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


///////////////Forms/////////////
exports.addVip = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      let user = new VIP({
        user_id: req.user._id,
        event_id: req.body.event_id,
        gender: req.body.gender,
        lat: req.body.lat,
        lng: req.body.lng,
        address: req.body.address,
        date: req.body.date,
        time: req.body.time,
        note: req.body.note,
        images: req.body.images,
        reciver_phone: req.body.reciver_phone,
        extra_note: req.body.extra_note,
        total: req.body.total,
        isNeedOffer: req.body.isNeedOffer,
        offer: 0,
        createAt:getCurrentDateTime(),
      });
      let rs = await user.save();  
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.FROMADMIN,
            MESSAGE_STRING_ENGLISH.FROMADMIN,
            rs
          )
        );
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.listVip = async (req, reply) => {
    const language = req.headers["accept-language"];
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
            $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
            $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
          },
        };
      }
      

      const total = await VIP.find(query).countDocuments();
      const item = await VIP.find(query)
        .sort({ _id: -1 })
        .populate("event_id")
        .populate("user_id", "-token")
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

exports.listExcelVip = async (req, reply) => {
  const language = req.headers["accept-language"];
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
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }

    const item = await VIP.find(query)
      .sort({ _id: -1 })
      .populate("event_id")
      .populate("user_id", "-token")
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }  
};

exports.addProductRequest = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      let user = new ProductRequest({
        user_id: req.user._id,
        title: req.body.title,
        note: req.body.note,
        images: req.body.images,
        total: req.body.total,
        name: req.body.name,
        iban: req.body.iban,
        category_id: req.body.category_id,
        createAt:getCurrentDateTime(),
      });
      let rs = await user.save();  
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.FROMADMIN,
            MESSAGE_STRING_ENGLISH.FROMADMIN,
            rs
          )
        );
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.listVipProductRequest = async (req, reply) => {
  const language = req.headers["accept-language"];
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
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }
    

    const total = await ProductRequest.find(query).countDocuments();
    const item = await ProductRequest.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("category_id")
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

exports.listExcelProductRequest = async (req, reply) => {
const language = req.headers["accept-language"];
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
        $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
        $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
      },
    };
  }
  

  const item = await ProductRequest.find(query)
    .sort({ _id: -1 })
    .populate("user_id", "-token")
    .select();

  const response = {
    status: true,
    code: 200,
    message: "تمت العملية بنجاح",
    items: item,
  };
  reply.code(200).send(response);
} catch (err) {
  reply.code(200).send(errorAPI(language, 400, err.message, err.message));
  return;
}  
};

exports.addProductRequestToProduct = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var check = await ProductRequest.findById(req.params.id);
    let rs = new Product({
        arName: check.title,
        enName: check.title,
        arDescription: check.title,
        enDescription: check.title,
        rate: 0,
        price: check.total,
        image: check.images[0],
        createat: getCurrentDateTime(),
        category_id: check.category_id,
        special_id: "6649ba3d7f7ad0728c62ab3b",
        isOffer: false,
        by: check.user_id,
        isDeleted: false,
        isFromUser: true,
      });
      var sp = await rs.save();  
      await ProductRequest.findByIdAndRemove(req.params.id);
      var userObj = await Users.findById(check.user_id)
      var msg = "تم تقييم منتجكم من قبل الادارة وقبوله يمكنكم البدء في بيع المنتج في تطبيق wishy"
      console.log(userObj.fcmToken)
      await CreateGeneralNotification(
        userObj.fcmToken,
        NOTIFICATION_TITILES.GENERAL,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        "",
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
            rs
          )
        );
  } catch (err) {
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
exports.removeProductRequest = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var check = await ProductRequest.findById(req.params.id);
      var userObj = await Users.findById(check.user_id)
      var msg = "تم رفض منتجكم من قبل الادارة"
      await CreateGeneralNotification(
        userObj.fcmToken,
        NOTIFICATION_TITILES.GENERAL,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        check._id,
        "",
        userObj._id,
        "",
        userObj.full_name
      );
      await ProductRequest.findByIdAndRemove(req.params.id);     
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
    console.log(err)
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
////////Admin//////
exports.getAllWishByUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var returnArr = []
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {$and:[{ product_id:{ $ne: null } }]}
    if (req.body.user_id && req.body.user_id != ""){
      query.$and.push({user_id: req.body.user_id})
    }
    if (req.body.isShare && req.body.isShare != ""){
      query.$and.push({isShare: req.body.isShare})
    }
    if (req.body.type && req.body.type != ""){
      query.$and.push({type: req.body.type})
    }
        if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }
    const total = await Wish.countDocuments(query);
    const items = await Wish.find(query)
    .populate({path: "user_id"})
    .populate({path: "product_id"})
    .populate({path: "group_id"})
    .skip(page * limit)
    .limit(limit)
    .sort({ _id: -1 });

      items.forEach(element => {
        const newObj = element.toObject();
        delete newObj.product_id.arName;
        delete newObj.product_id.enName;
        delete newObj.product_id.arDescription;
        delete newObj.product_id.enDescription;
        newObj.product_id.name = element.product_id[`${language}Name`];
        newObj.product_id.description = element.product_id[`${language}Description`];
        returnArr.push(newObj);
      });

      reply.code(200).send(
        success(
          language, 
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          returnArr,
          {
            size: items.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
         })
      );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};