const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  register: async (req, res) => {
    try {
      const { full_name, email, phone, password, confirm_password } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Định dạng email không hợp lệ.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu phải có ít nhất 6 ký tự.'
        });
      }

      if (confirm_password !== undefined && password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu nhập lại không khớp.'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email này đã được đăng ký.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUserId = await User.create({
        full_name: full_name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null
      });

      const newUser = await User.findById(newUserId);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công!',
        data: newUser
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi đăng ký.'
      });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập email và mật khẩu.'
        });
      }

      const user = await User.findByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email hoặc mật khẩu không chính xác.'
        });
      }

      if (user.status === 'locked') {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Email hoặc mật khẩu không chính xác.'
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const { password: _, ...userData } = user;

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công!',
        data: {
          token,
          user: userData
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi đăng nhập.'
      });
    }
  },

  logout: (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công!'
    });
  },

  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng.'
        });
      }

      if (user.status === 'locked') {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Lấy thông tin người dùng thành công.',
        data: user
      });
    } catch (error) {
      console.error('GetMe error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ.'
      });
    }
  }
};

module.exports = authController;