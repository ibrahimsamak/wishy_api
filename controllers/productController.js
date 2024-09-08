// External Dependancies
const boom = require("boom");
const jwt = require("jsonwebtoken");
const config = require("config");
const fs = require("fs");
const async = require("async");
const lodash = require("lodash");
const moment = require("moment-timezone");
const mongoose = require("mongoose");

const {
  Category,
  Product,
  Supplier,
  Product_Price,
  Place_Delivery,
} = require("../models/Product");
const {
  encryptPassword,
  mail_reset_password,
  makeid,
  uploadImages,
  CreateGeneralNotification,
  CreateNotification,
  sendSMS,
  handleError,
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const { getCurrentDateTime } = require("../models/Constant");
const { Favorite } = require("../models/Favorite");
const { Adv } = require("../models/adv");
const { request } = require("request");


exports.getProductsByCategoryId = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const user_id = req.user._id;

    // const lat = req.query.lat;
    // const lng = req.query.lng;
    var returnArr = [];

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    // get products prices in location

    var query1 = {$and:[{isDeleted:false}]}
    if (req.query.q && req.query.q != "") {
        query1.$and.push({
          $or: [
            { arName: { $regex: new RegExp(req.query.q, "i") } },
            { enName: { $regex: new RegExp(req.query.q, "i") } },
          ],
      })
    }
    if (req.query.category_id && req.query.category_id != "") {
        query1.$and.push({category_id: req.query.category_id});
    }
    if (req.query.special_id && req.query.special_id != "") {
        query1.$and.push({special_id: req.query.special_id});
    }
    if (req.query.isOffer && req.query.isOffer != "") {
        query1.$and.push({isOffer: req.query.isOffer});
    }
    if (req.query.from_user && req.query.from_user != "") {
       query1.$and.push({isFromUser: req.query.from_user});
     }

    var total = await Product.countDocuments(query1);
    var item = await Product.find(query1)
    // .populate("by")
    // .populate("special_id")
    .sort({ _id: -1 })
    .skip(page * limit)
    .limit(limit);

    for await (const data of item) {
      const checkFavorite = await Favorite.findOne({
        $and: [
          { user_id: user_id },
          { product_id: data._id },
        ],
      });
      const newObj = data.toObject();
      if (checkFavorite) {
        newObj.favorite_id = checkFavorite._id;
      } else {
        newObj.favorite_id = null;
      }

      delete newObj.arName;
      delete newObj.enName;
      delete newObj.arDescription;
      delete newObj.enDescription;
      newObj.name = data[`${language}Name`];
      newObj.description = data[`${language}Description`];
      returnArr.push(newObj);
    }

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        returnArr,
        {
          size: returnArr.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

////////////admin///////////
exports.getAllProductsList = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    // var query = {};
    var query = { $and: [] };
    query.$and.push({ isDeleted: false });

    const item = await Product.find(query)
      .populate("supplier_id")
      .populate("category_id")
      .sort({_id:-1})
    var obj = {};
    obj["status"] = true;
    obj["code"] = 200;
    obj["message"] = "تمت العملية بنجاح";
    obj["items"] = item;

    reply.code(200).send(obj);
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAllProductsByAdmin = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    // var query = {};
    var query = { $and: [] };
    if (String(req.body.name) != "") {
      query.$and.push({
        $or: [
          { arName: { $regex: new RegExp(req.body.name, "i") } },
          { arDescription: { $regex: new RegExp(req.body.name, "i") } },
          { enName: { $regex: new RegExp(req.body.name, "i") } },
          { enDescription: { $regex: new RegExp(req.body.name, "i") } },
        ],
      });
    }
    if (req.body.category_id != "") {
      query.$and.push({ category_id: req.body.category_id });
    }

    query.$and.push({ isDeleted: false });

    const total = await Product.find(query).countDocuments();
    const item = await Product.find(query)
      .populate("category_id")
      .sort({_id:-1})
      .skip(page * limit)
      .limit(limit);
    var obj = {};
    obj["status"] = true;
    obj["code"] = 200;
    obj["message"] = "تمت العملية بنجاح";
    obj["items"] = item;
    obj["pagination"] = {
      size: item.length,
      totalElements: total,
      totalPages: Math.floor(total / limit),
      pageNumber: page,
    };

    reply.code(200).send(obj);
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAllProductsExcelByAdmin = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var query = { $and: [] };
    if (String(req.body.name) != "") {
      query.$and.push({
        $or: [
          { arName: { $regex: new RegExp(req.body.name, "i") } },
          { arDescription: { $regex: new RegExp(req.body.name, "i") } },
          { enName: { $regex: new RegExp(req.body.name, "i") } },
          { enDescription: { $regex: new RegExp(req.body.name, "i") } },
        ],
      });
    }
    if (req.body.category_id != "") {
      query.$and.push({ category_id: req.body.category_id });
    }

    query.$and.push({ isDeleted: false });

    const total = await Product.find(query).countDocuments();
    const item = await Product.find(query).populate("category_id").sort({_id:-1});
    var obj = {};
    obj["status"] = true;
    obj["code"] = 200;
    obj["message"] = "تمت العملية بنجاح";
    obj["items"] = item;
    reply.code(200).send(obj);
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteProduct = async (req, reply) => {
  try {
    await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

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

exports.addProduct = async (req, reply) => {
  try {
    console.log(req.raw);
    if (req.raw.files) {
      var img = "";

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

      await uploadImages(files.image.name).then((x) => {
        img = x;
      });

      let rs = new Product({
        arName: req.raw.body.arName,
        enName: req.raw.body.enName,
        arDescription: req.raw.body.arDescription,
        enDescription: req.raw.body.enDescription,
        rate: 0,
        sale_price: req.raw.body.sale_price,
        cost_price: req.raw.body.sale_price,
        image: img,
        createat: getCurrentDateTime(),
        category_id: req.raw.body.category_id,
        special_id: req.raw.body.special_id,
        isOffer: req.raw.body.isOffer,
        isDeleted: false,
        isOffer: req.raw.body.isOffer,
        by: "Admin",
        isFromUser: req.raw.body.isFromUser,
        SKU: mongoose.Types.ObjectId()
      });
      var _return = handleError(rs.validateSync());
      if (_return.length > 0) {
        reply.code(200).send({
          status_code: 400,
          status: false,
          message: _return[0],
          items: _return,
        });
        return;
      }
      let saved = await rs.save();

      const response = {
        status_code: 200,
        status: true,
        message: "تمت اضافة المنتج بنجاح",
        items: saved,
      };
      reply.send(response);
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateProduct = async (req, reply) => {
  try {
    if (req.raw.files) {
      var img = "";
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

      await uploadImages(files.image.name).then((x) => {
        img = x;
      });

      let prod = await Product.findByIdAndUpdate(
        { _id: req.params.id },
        {
          arName: req.raw.body.arName,
          enName: req.raw.body.enName,
          arDescription: req.raw.body.arDescription,
          enDescription: req.raw.body.enDescription,
          image: img,
          category_id: req.raw.body.category_id,
          special_id: req.raw.body.special_id,
          sale_price: req.raw.body.sale_price,
          cost_price: req.raw.body.sale_price,
          isOffer: req.raw.body.isOffer,
          by: "Admin",
          isFromUser: req.raw.body.isFromUser,
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
      const response = {
        status_code: 200,
        status: true,
        message: "تم الحفظ بنجاح",
        items: prod,
      };
      reply.send(response);
    } else {
      const prod = await Product.findByIdAndUpdate(
        req.params.id,
        {
          arName: req.raw.body.arName,
          enName: req.raw.body.enName,
          arDescription: req.raw.body.arDescription,
          enDescription: req.raw.body.enDescription,
          category_id: req.raw.body.category_id,
          special_id: req.raw.body.special_id,
          isOffer: req.raw.body.isOffer,
          sale_price: req.raw.body.sale_price,
          by: req.raw.body.by,
          isOffer: req.raw.body.isOffer,
          isFromUser: req.raw.body.isFromUser,
        },
        { new: true }
      );
      const response = {
        status_code: 200,
        status: true,
        message: "تم الحفظ بنجاح",
        items: prod,
      };
      reply.send(response);
    }
  } catch (err) {
    console.log(err);
    throw boom.boomify(err);
  }
};

exports.getSingleProduct = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const prod = await Product.findById(req.params.id)
    // .populate("by");
    const checkFavorite = await Favorite.findOne({
      $and: [
        { user_id: req.user._id },
        { product_id: req.params.id },
      ],
    });
    const newObj = prod.toObject();
    if (checkFavorite) {
      newObj.favorite_id = checkFavorite._id;
    } else {
      newObj.favorite_id = null;
    }

    delete newObj.arName;
    delete newObj.enName;
    delete newObj.arDescription;
    delete newObj.enDescription;
    newObj.name = prod[`${language}Name`];
    newObj.description = prod[`${language}Description`];

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: newObj,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAdminSingleProduct = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const prod = await Product.findById(req.params.id)
    
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: prod,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAllProductPlaceByAdmin = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    // var query = {};
    var query = { $and: [] };
    if (req.query.name && String(req.query.name) != "") {
      query.$and.push({
        $or: [
          { arName: { $regex: new RegExp(req.query.name, "i") } },
          { arDescription: { $regex: new RegExp(req.query.name, "i") } },
          { enName: { $regex: new RegExp(req.query.name, "i") } },
          { enDescription: { $regex: new RegExp(req.query.name, "i") } },
        ],
      });
    }
    if (req.query.category_id && req.query.category_id != "") {
        query.$and.push({ category_id: req.query.category_id });
    }
    if (req.query.special_id  && req.query.special_id != "") {
        query.$and.push({ special_id: req.query.special_id });
    }
  
    console.log(query)
    query.$and.push({ isDeleted: false });
    const total = await Product.find(query).countDocuments();
    const item = await Product.find(query)
      .populate("category_id")
      .populate("special_id")
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    var obj = {};
    obj["status"] = true;
    obj["code"] = 200;
    obj["message"] = "تمت العملية بنجاح";
    obj["items"] = item;
    obj["pagination"] = {
      size: item.length,
      totalElements: total,
      totalPages: Math.floor(total / limit),
      pageNumber: page,
    };

    reply.code(200).send(obj);
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getAllProductPlaceExcelByAdmin = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var query = { $and: [] };
    if (String(req.body.name) != "") {
      query.$and.push({
        $or: [
          { arName: { $regex: new RegExp(req.body.name, "i") } },
          { arDescription: { $regex: new RegExp(req.body.name, "i") } },
          { enName: { $regex: new RegExp(req.body.name, "i") } },
          { enDescription: { $regex: new RegExp(req.body.name, "i") } },
        ],
      });
    }
    if (req.body.category_id != "") {
      query.$and.push({ category_id: req.body.category_id });
    }
    if (req.body.special_id != "") {
        query.$and.push({ special_id: req.body.special_id });
    }

    query.$and.push({ isDeleted: false });
    const total = await Product.find(query).countDocuments();
    const item = await Product.find(query)
    .populate("category_id")
    .populate("special_id")
      .sort({ _id: -1 });

    var obj = {};
    obj["status"] = true;
    obj["code"] = 200;
    obj["message"] = "تمت العملية بنجاح";
    obj["items"] = item;
    reply.code(200).send(obj);
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteProductPlace = async (req, reply) => {
  try {
    await Product_Price.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

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

exports.addProductPlace = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var check = await Product_Price.findOne({$and:[{category_id: req.body.category_id}, {place_id: req.body.place_id}]})
    if(check){
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          200,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT
        )
      );
      return
    }
    let rs = new Product_Price({
      category_id: req.body.category_id,
      place_id: req.body.place_id,
      supplier_id: req.body.supplier_id,
      city_id: req.body.city_id,
      createAt: getCurrentDateTime(),
      isDeleted: false,
    });
    var _return = handleError(rs.validateSync());
    if (_return.length > 0) {
      reply.code(200).send({
        status_code: 400,
        status: false,
        message: _return[0],
        items: _return,
      });
      return;
    }
    let saved = await rs.save();

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          saved
        )
      );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateProductPlace = async (req, reply) => {
  try {
    let prod = await Product_Price.findByIdAndUpdate(
      { _id: req.params.id },
      {
        category_id: req.body.category_id,
        place_id: req.body.place_id,
        supplier_id: req.body.supplier_id,
        city_id: req.body.city_id
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
    const response = {
      status_code: 200,
      status: true,
      message: "تم الحفظ بنجاح",
      items: prod,
    };
    reply.send(response);
  } catch (err) {
    console.log(err);
    throw boom.boomify(err);
  }
};

exports.getSingleProductPlace = async (req, reply) => {
  try {
    const prod = await Product_Price.findById(req.params.id)
      .populate("supplier_id")
      .populate({
        path: "supplier_id",
        populate: {
          path: "cities",
        },
      });
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: prod,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.addSupplierPlace = async (req, reply) => {
  try {
    const checkBefore = await Place_Delivery.findOne({
      $and: [
        { place_id: req.body.place_id },
        { city_id: req.body.city_id },
        { supplier_id: req.body.supplier_id },
        {isDeleted:false}
      ],
    });
    if (checkBefore) {
      const response = {
        status_code: 400,
        status: false,
        message: "هذه البيانات موجودة من قبل",
        items: [],
      };
      reply.code(200).send(response);
      return
    }
    let _place = new Place_Delivery({
      place_id: req.body.place_id,
      supplier_id: req.body.supplier_id,
      city_id: req.body.city_id,
    });

    var _return = handleError(_place.validateSync());
    if (_return.length > 0) {
      reply.code(200).send({
        status_code: 400,
        status: false,
        message: _return[0],
        items: _return,
      });
      return;
    }

    let rs = await _place.save();
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: rs,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateSupplierPlace = async (req, reply) => {
  try {
    const checkBefore = await Place_Delivery.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { place_id: req.body.place_id },
        { city_id: req.body.city_id },
        { supplier_id: req.body.supplier_id },
        { isDelete: false }
      ],
    });
    if (checkBefore) {
      const response = {
        status_code: 400,
        status: false,
        message: "هذه البيانات موجودة من قبل",
        items: [],
      };
      reply.code(200).send(response);
      return
    }
    const _place = await Place_Delivery.findByIdAndUpdate(
      req.params.id,
      {
        place_id: req.body.place_id,
        supplier_id: req.body.supplier_id,
        city_id: req.body.city_id,
      },
      { new: true }
    );

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: _place,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.deleteSupplierPlace = async (req, reply) => {
  try {
    const _place = await Place_Delivery.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

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

exports.getSupplierPlaceAdmin = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var arr = [];
    const language = req.headers["accept-language"];
    const total = await Place_Delivery.find({
      $and: [{ place_id: req.body.place_id }, { city_id: req.body.city_id },{isDeleted:false}],
    }).countDocuments();
    const cities = await Place_Delivery.find({
      $and: [{ place_id: req.body.place_id }, { city_id: req.body.city_id },{isDeleted:false}],
    })
      .populate("supplier_id")
      .populate("place_id")
      .populate("city_id")
      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 });

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        cities,
        {
          size: cities.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getSingleSupplierPlace = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const _place = await Place_Delivery.findById(req.params.id)
      .populate("supplier_id")
      .populate({
        path: "supplier_id",
        populate: {
          path: "cities",
        },
      });
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          _place
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};


//////////// m5azen ////////////

exports.newProduct = async (req, reply) => {
  try {
    var check = await Product.findOne({$and:[{SKU: req.body.SKU}, {isDeleted: false}]})
    if(check){
      const response = {
        status_code: 400,
        status: false,
        message: "هذا المنتج موجود مسبقا",
        items: null,
      };
      reply.send(response);
      return
    }
      let rs = new Product({
        arName: req.body.arName,
        enName: req.body.enName,
        arDescription: req.body.arDescription,
        enDescription: req.body.enDescription,
        rate: 0,
        sale_price: req.body.sale_price,
        image: req.body.image,
        createat: getCurrentDateTime(),
        category_id: req.body.category_id,
        special_id: null,//req.body.special_id,
        quantity: req.body.quantity,
        cost_price: req.body.cost_price,
        isDeleted: false,
        isOffer: false,
        by: "Ma5azen",
        isFromUser: false,
        SKU: req.body.SKU//mongoose.Types.ObjectId()
      });
      var _return = handleError(rs.validateSync());
      if (_return.length > 0) {
        reply.code(200).send({
          status_code: 400,
          status: false,
          message: _return[0],
          items: _return,
        });
        return;
      }
      let saved = await rs.save();

      const response = {
        status_code: 200,
        status: true,
        message: "تمت اضافة المنتج بنجاح",
        items: saved,
      };
      reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.editProduct = async (req, reply) => {
  try {
    let prod = await Product.findByIdAndUpdate(
      { _id: req.params.id },
      {
          arName: req.body.arName,
          enName: req.body.enName,
          arDescription: req.body.arDescription,
          enDescription: req.body.enDescription,
          image: req.body.image,
          category_id: req.body.category_id,
          special_id: null,//req.body.special_id,
          sale_price: req.body.sale_price,
          quantity: req.body.quantity,
          cost_price: req.body.cost_price,
          isOffer: false,
          isFromUser: false,
          by:"Ma5azen",
          SKU: req.body.SKU//mongoose.Types.ObjectId()
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
    const response = {
      status_code: 200,
      status: true,
      message: "تم الحفظ بنجاح",
      items: prod,
    };
    reply.send(response);
  } catch (err) {
    console.log(err);
    throw boom.boomify(err);
  }
};


exports.editBulkProduct = async (req, reply) => {
  try {
     var list = req.body.list
     for await(const item of list) {
      let prod = await Product.findByIdAndUpdate(
        { _id: item._id },
        {
            // arName: item.arName,
            // enName: item.enName,
            arDescription: item.arDescription,
            enDescription: item.enDescription,
            image: item.image,
            // category_id: item.category_id,
            special_id: null,//item.special_id,
            sale_price: item.sale_price,
            quantity: item.quantity,
            cost_price: item.cost_price,
            isOffer: false,
            isFromUser: false,
            by:"Ma5azen",
            SKU: item.SKU//mongoose.Types.ObjectId()
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
     }
    const response = {
      status_code: 200,
      status: true,
      message: "تم الحفظ بنجاح",
      items: [],
    };
    reply.send(response);
  } catch (err) {
    console.log(err);
    throw boom.boomify(err);
  }
};
