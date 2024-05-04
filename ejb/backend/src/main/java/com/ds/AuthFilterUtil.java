package com.ds;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class AuthFilterUtil {
    public static void allowRole(AppDataSource ds, ServletRequest request, ServletResponse response, FilterChain chain,
            String role) throws SQLException, IOException, ServletException {
        // Extract id, password
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        String authHeader = req.getHeader("Authorization");
        if (authHeader == null) {
            res.setStatus(401);
            return;
        }
        // get user
        // if no user 401
        // if invalid role 403
        chain.doFilter(request, response);
    }
}
