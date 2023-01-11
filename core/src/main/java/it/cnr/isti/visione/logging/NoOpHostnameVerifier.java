package it.cnr.isti.visione.logging;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLSession;

public class NoOpHostnameVerifier implements HostnameVerifier {
    @Override
    public boolean verify(String s, SSLSession sslSession) {
        return true;
    }
}
