package com.ds;

import java.io.IOException;
import java.sql.SQLException;

import jakarta.ejb.EJB;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.annotation.WebFilter;

@WebFilter(filterName = "AuthFilter", urlPatterns = { "" })
public class AuthFilter implements Filter {
    @EJB
    private AppDataSource dataSource;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            AuthFilterUtil.allowRole(dataSource, request, response, chain, "*");
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

}
