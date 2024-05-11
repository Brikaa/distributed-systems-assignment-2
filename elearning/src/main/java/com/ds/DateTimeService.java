package com.ds;

import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;

@Singleton
@Startup
public class DateTimeService {
    private boolean shouldFake;
    private Long currentDate;

    @PostConstruct
    public void init() {
        shouldFake = System.getenv("FAKE_DATE") != null && System.getenv("FAKE_DATE").equalsIgnoreCase("true");
    }

    public boolean getShouldFake() {
        return shouldFake;
    }

    public long getTimestamp() {
        if (!shouldFake)
            return System.currentTimeMillis();
        else
            return currentDate == null ? System.currentTimeMillis() : currentDate;
    }

    public void setTimestamp(long newDate) {
        currentDate = newDate;
    }
}
