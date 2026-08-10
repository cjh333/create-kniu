### 注意：阿里云虚拟主机一定要控制器目录名称首字母大写，否则无法访问，
### 例如：app/Controllers/IndexController.php中的 Controllers 目录名称必须首字母大写。
### 运行项目步骤：
### 1.先彻底杀掉 PHP 进程。
```
taskkill /F /IM php.exe
```
### 2.进入项目 api 目录。
```
cd api
```
### 3.安装依赖。
```
composer install
```
### 4.生成自动加载文件。
```
<!-- composer dump-autoload -d d:\D05Temp\test-KniuSystem\api -->
composer dump-autoload -d d:\D06Myself\D0602TMP\test-kniu\htdocs\api
```
### 5.启动服务器。
```
<!-- php -S localhost:9900 -t d:\D05Temp\test-KniuSystem\api -->
php -S localhost:9900 -t d:\D06Myself\D0602TMP\test-kniu\htdocs\api
```
### 6.访问地址（后端接口）。
```
http://localhost:9900
```
### 7.进入项目 views 目录。
```
cd views
```
### 8.运行前端模板。
```
npm run dev
```
### 9.访问地址（前端模板）。
```
http://localhost:6173
```