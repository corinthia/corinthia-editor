import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpContext;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.*;
import java.util.zip.*;
import java.util.concurrent.Executors;
import javax.jws.WebMethod;
import javax.jws.WebService;
import javax.jws.soap.SOAPBinding;
import javax.xml.ws.Endpoint;

public class Server
{

  // See: 
  // http://java.sun.com/javase/6/docs/jre/api/net/httpserver/spec/index.html
  // http://jtute.com/java6/0406.html

  public static class BasicHandler implements HttpHandler
  {
    // Override default behaviour of built-in WS server, which doesn't
    // handle HEAD requests correctly
    public void handle(HttpExchange exchange)
      throws IOException
    {
      InputStream in = exchange.getRequestBody();
      InputStreamReader reader = new InputStreamReader(in);
      char[] buf = new char[1024];
      StringBuilder builder = new StringBuilder();
      int r;
      while (0 < (r = reader.read(buf)))
        builder.append(buf,0,r);
      String postRequest = builder.toString();

      URI uri = exchange.getRequestURI();

      if (uri.getPath().equals("/")) {
        handleFrontPage(exchange);
      }
      else {
        String noLeadingSlash = uri.getPath().substring(1);
        boolean handled = false;
        int split = noLeadingSlash.indexOf("/");
        if (split >= 0) {
          String command = noLeadingSlash.substring(0,split);
          String arg = noLeadingSlash.substring(split+1);
          System.out.println(command+" "+arg);
          try {
            if (command.equals("mkdir"))
              handled = mkdir(exchange,arg);
            else if (command.equals("read"))
              handled = read(exchange,arg);
            else if (command.equals("write"))
              handled = write(exchange,arg,postRequest);
            else if (command.equals("remove"))
              handled = remove(exchange,arg);
            else if (command.equals("mkdocx"))
              handled = mkdocx(exchange,arg);
            else
              throw new Exception("Unknown command \""+command+"\"");
          } catch (FileNotFoundException e) {
            sendResponse(exchange,404,e.toString());
          } catch (Exception e) {
            sendResponse(exchange,500,e.toString());
          }
        }
      }

      return;
    }
  }

  public static boolean mkdir(HttpExchange exchange, String filename)
    throws IOException
  {
    File file = new File(filename);
    if (!file.mkdirs())
      throw new IOException("Could not create directory \""+filename+"\"");

    Headers headers = exchange.getResponseHeaders();
    headers.set("Content-Type","text/plain");
    exchange.sendResponseHeaders(200,-1);
    return true;
  }

  public static boolean read(HttpExchange exchange, String filename)
    throws IOException
  {
    InputStream in = null;

    String[] parts = filename.split("/");
    for (int i = 0; i < parts.length-1; i++) {
      if (parts[i].toLowerCase().endsWith(".zip") || parts[i].toLowerCase().endsWith(".docx")) {
        String zipFilename = "";
        String entryName = "";

        for (int j = 0; j <= i; j++) {
          if (zipFilename.equals(""))
            zipFilename += parts[j];
          else
            zipFilename += "/"+parts[j];
        }

        for (int j = i+1; j < parts.length; j++) {
          if (entryName.equals(""))
            entryName += parts[j];
          else
            entryName += "/"+parts[j];
        }

        System.out.println("zipFilename = "+zipFilename+", entryName = "+entryName);

        File file = new File(zipFilename);
        if (!file.exists())
          throw new FileNotFoundException(filename);
        ZipFile zip = new ZipFile(file);
        ZipEntry entry = zip.getEntry(entryName);
        if (entry == null)
          throw new FileNotFoundException(filename);
        in = zip.getInputStream(entry);

        break;
      }
    }

    if (in == null)
      in = new FileInputStream(filename);

    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buf = new byte[1024];
    int r;
    while (0 < (r = in.read(buf)))
      out.write(buf,0,r);
    in.close();

    Headers headers = exchange.getResponseHeaders();
    if (filename.endsWith(".html"))
      headers.set("Content-Type","text/html");
    else if (filename.endsWith(".xml"))
      headers.set("Content-Type","text/xml");
    else if (filename.endsWith(".svg"))
      headers.set("Content-Type","image/svg+xml");
    else if (filename.endsWith(".js"))
      headers.set("Content-Type","text/javascript");
    else if (filename.endsWith(".css"))
      headers.set("Content-Type","text/css");
    else
      headers.set("Content-Type","text/plain");
    exchange.sendResponseHeaders(200,0);

    OutputStream responseOut = exchange.getResponseBody();
    responseOut.write(out.toByteArray());
    responseOut.close();
    exchange.close();
    return true;
  }

  public static boolean write(HttpExchange exchange, String filename, String contents)
    throws IOException
  {
    FileWriter writer = new FileWriter(filename);
    writer.write(contents);
    writer.close();

    sendResponse(exchange,200,"OK");
    return true;
  }

  public static boolean remove(HttpExchange exchange, String filename)
    throws IOException
  {
    File file = new File(filename);
    if (file.exists()) {
      if (!file.delete())
        throw new IOException("Could not delete \""+filename+"\"");
    }

    sendResponse(exchange,200,"OK");
    return true;
  }

  public static boolean mkdocx(HttpExchange exchange, String filename)
    throws IOException, InterruptedException
  {
    ProcessBuilder builder = new ProcessBuilder("./mkdocx",filename);
    Process process = builder.start();
    process.waitFor();

    sendResponse(exchange,200,"OK");
    return true;
  }

  public static void sendResponse(HttpExchange exchange, int status, String response)
  {
    try {
      Headers headers = exchange.getResponseHeaders();
      headers.set("Content-Type","text/plain");
      exchange.sendResponseHeaders(status,0);

      OutputStream responseOut = exchange.getResponseBody();
      PrintWriter writer = new PrintWriter(responseOut);
      writer.print(response);
      writer.close();
      exchange.close();
    }
    catch (IOException e) {
      e.printStackTrace();
    }
  }

  public static void handleTest(HttpExchange exchange)
    throws IOException
  {
    System.out.println("handleTest start");
    Headers headers = exchange.getResponseHeaders();
    headers.set("Content-Type","text/plain");
    // headers.set("Content-Length","0");
    exchange.sendResponseHeaders(200,0);

    OutputStream response = exchange.getResponseBody();
    PrintWriter out = new PrintWriter(response);
    out.println("Hello");
    out.close();

    exchange.close();
    System.out.println("handleTest end");
  }

  public static void handleFrontPage(HttpExchange exchange)
    throws IOException
  {
    Headers headers = exchange.getResponseHeaders();
    headers.set("Content-Type","text/html");
    exchange.sendResponseHeaders(200,0);

    FileInputStream file = new FileInputStream("client.html");
    byte[] buf = new byte[1024];
    int r;
    OutputStream response = exchange.getResponseBody();
    while (0 < (r = file.read(buf))) {
      response.write(buf,0,r);
    }
    response.close();
    exchange.close();
  }

  public static void main(String[] args)
    throws IOException
  {
    int port = 8080;

    HttpServer server = HttpServer.create(new InetSocketAddress(port), 5);
    // server.setExecutor(Executors.newFixedThreadPool(3));

    //    Endpoint endpoint = Endpoint.create(new Marks());
    //    endpoint.publish(server.createContext("/marks"));

    HttpContext context = server.createContext("/");
    context.setHandler(new BasicHandler());
    server.start();
    System.out.println("Started");
  }
}
